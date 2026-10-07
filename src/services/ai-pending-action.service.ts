import type {
  AiPendingAction,
  AiPendingActionStatus,
  Prisma,
} from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { logFields } from '@/lib/axiom/log-fields'
import { logger } from '@/lib/axiom/logger'
import {
  aiAgentModeDisabled,
  aiDoubleConfirmationRequired,
  aiPendingActionExpired,
  aiPendingActionNotFound,
  aiPendingActionNotPending,
  aiToolNotAllowed,
} from '@/src/errors/app-error'
import {
  type AiToolRunResult,
  findTool,
  isToolAllowed,
  proposeWriteTool,
  resolveToolAccess,
  runTool,
} from '@/src/lib/ai/tools/registry'
import {
  actionResultCallId,
  serializeToolResult,
  TOOL_OUTPUT_MAX_BYTES,
  type ToolResultPayload,
} from '@/src/lib/ai/tools/tool-result'
import type { AiToolContext, AnySteelAiTool } from '@/src/lib/ai/tools/types'
import { err, ok, type Result } from '@/src/lib/result'
import { toAiPendingActionDTO } from '@/src/mappers/ai-pending-action.mapper'
import { AiActionLogRepository } from '@/src/repositories/ai-action-log.repository'
import { AiMessageRepository } from '@/src/repositories/ai-conversation.repository'
import { AiPendingActionRepository } from '@/src/repositories/ai-pending-action.repository'
import type { ConfirmAiPendingActionDTO } from '@/src/schemas/steel-ai.schema'
import type { AiPendingActionDTO } from '@/types/steel-ai'
import { assertMember } from './authz'

/**
 * Appends the human decision to the conversation as a TOOL row (synthetic
 * call id `action:<id>`), so the model knows the outcome on the next turn.
 * Failure only logs — the action itself is already decided.
 */
async function appendDecision(
  action: AiPendingAction,
  payload: ToolResultPayload,
): Promise<void> {
  if (!action.conversationId) return
  const appended = await AiMessageRepository.createMany([
    {
      conversationId: action.conversationId,
      role: 'TOOL',
      toolCallId: actionResultCallId(action.id),
      toolName: action.toolName,
      content: serializeToolResult(payload),
    },
  ])
  if (!appended.ok) {
    logger.error(
      'steel_ai.decision_append_failed',
      logFields({
        component: 'AiPendingActionService',
        workspaceId: action.workspaceId,
        conversationId: action.conversationId,
        actionId: action.id,
        message: appended.error.message,
      }),
    )
  }
}

/** Outcome of running a claimed action, plus the raw tool run. */
interface ClaimedRun {
  action: AiPendingAction
  run: AiToolRunResult
}

/**
 * Runs a claimed action and records it everywhere: outcome on the row
 * (EXECUTED or FAILED), AiActionLog and audit. `autopilot` marks writes
 * that ran without a confirmation (audit action `auto_execute`).
 */
async function runClaimed(
  action: AiPendingAction,
  tool: AnySteelAiTool,
  input: {
    ctx: AiToolContext
    deciderId: string | null
    autopilot?: boolean
  },
): Promise<Result<ClaimedRun>> {
  const run = await runTool(
    tool,
    input.ctx,
    action.args as Record<string, unknown>,
  )
  const target = run.ok ? run.output.target : undefined

  const completed = await AiPendingActionRepository.complete(
    action.id,
    run.ok
      ? {
          status: 'EXECUTED',
          result: {
            summary: run.output.summary,
            ...(target && { target }),
          } as Prisma.InputJsonValue,
          executedAt: new Date(),
        }
      : { status: 'FAILED', error: run.error.message },
  )
  if (!completed.ok) return completed

  const log = await AiActionLogRepository.create({
    workspaceId: action.workspaceId,
    source: input.ctx.source === 'agent' ? 'AGENT' : 'ASSISTANT',
    actorId: input.deciderId,
    agentId: input.ctx.agentId ?? null,
    pendingActionId: action.id,
    toolName: action.toolName,
    kind: action.kind,
    module: action.module,
    targetType: target?.type ?? null,
    targetId: target?.id ?? null,
    args: action.args as Prisma.InputJsonValue,
    outcome: run.ok ? 'success' : 'failure',
    summary: run.ok ? run.output.summary : null,
    error: run.ok ? null : run.error.message,
  })
  if (!log.ok) {
    logger.error(
      'steel_ai.action_log_failed',
      logFields({
        component: 'AiPendingActionService',
        workspaceId: action.workspaceId,
        actionId: action.id,
        message: log.error.message,
      }),
    )
  }

  auditMutation({
    entity: 'ai_pending_action',
    action: input.autopilot ? 'auto_execute' : 'confirm',
    actorId: input.deciderId,
    targetId: action.id,
    outcome: run.ok ? 'success' : 'failure',
    ...(!run.ok && { reason: run.error.code }),
    meta: {
      workspaceId: action.workspaceId,
      toolName: action.toolName,
      kind: action.kind,
      module: action.module,
      targetType: target?.type,
      targetRecordId: target?.id,
      ...(input.autopilot && { mode: 'AUTOPILOT' }),
    },
  })

  return ok({ action: completed.value, run })
}

/**
 * Executes an action that the caller already claimed (conditional
 * `PENDING → EXECUTED`): re-parses `args`, runs the tool, stores the
 * outcome (EXECUTED or FAILED), writes the AiActionLog + audit and appends
 * the result to the conversation. Shared with Steel Agents, whose approval
 * flow claims the action its own way.
 */
export async function executeClaimedAction(
  action: AiPendingAction,
  tool: AnySteelAiTool,
  input: {
    ctx: AiToolContext
    /** Human who confirmed/approved (null = automatic agent tool). */
    deciderId: string | null
  },
): Promise<Result<AiPendingAction>> {
  const claimed = await runClaimed(action, tool, input)
  if (!claimed.ok) return claimed
  const { run } = claimed.value

  await appendDecision(
    action,
    run.ok
      ? {
          status: 'executed',
          actionId: action.id,
          summary: run.output.summary,
          data: run.output.data,
          note: 'O usuário confirmou e a ação foi executada.',
        }
      : {
          status: 'failed',
          actionId: action.id,
          error: { code: run.error.code, message: run.error.message },
          note: 'O usuário confirmou, mas a execução falhou.',
        },
  )

  return ok(claimed.value.action)
}

const AUTOPILOT_DONE_NOTE =
  'Executada automaticamente (modo Autopilot), sem pedir confirmação. Informe o resultado ao usuário.'
const AUTOPILOT_FAILED_NOTE =
  'A execução automática (modo Autopilot) falhou; nada foi alterado por esta chamada.'

/**
 * AUTOPILOT write: `parse` → `preview` (shown as the result card) → row born
 * claimed by the user → execute now → AiActionLog (ASSISTANT, actor = user)
 * + audit `auto_execute`. Deletes and customer-facing actions included —
 * the workspace opted in (`autopilotEnabled`). `content` is the tool result
 * for the model (the turn persists it as the TOOL row, so no decision note
 * is appended). A failed `parse`/`preview` creates nothing.
 */
export async function executeAutopilotWrite(
  tool: AnySteelAiTool,
  ctx: AiToolContext,
  rawArgs: Record<string, unknown>,
  origin: { conversationId: string; toolCallId: string },
  now: Date = new Date(),
): Promise<Result<{ action: AiPendingAction; content: string }>> {
  const created = await proposeWriteTool(
    tool,
    ctx,
    rawArgs,
    { ...origin, claimedBy: ctx.actorId },
    now,
  )
  if (!created.ok) return created

  const claimed = await runClaimed(created.value, tool, {
    ctx,
    deciderId: ctx.actorId,
    autopilot: true,
  })
  if (!claimed.ok) return claimed
  const { action, run } = claimed.value

  logger.info(
    'steel_ai.autopilot_executed',
    logFields(
      {
        component: 'AiPendingActionService',
        workspaceId: ctx.workspaceId,
        conversationId: origin.conversationId,
        actionId: action.id,
      },
      { toolName: tool.name, kind: tool.kind, status: action.status },
    ),
  )

  const payload: ToolResultPayload = run.ok
    ? {
        status: 'executed',
        actionId: action.id,
        summary: run.output.summary,
        data: run.output.data,
        note: AUTOPILOT_DONE_NOTE,
      }
    : {
        status: 'failed',
        actionId: action.id,
        error: { code: run.error.code, message: run.error.message },
        note: AUTOPILOT_FAILED_NOTE,
      }
  return ok({
    action,
    content: serializeToolResult(payload, TOOL_OUTPUT_MAX_BYTES),
  })
}

/** Answer for an action that is no longer PENDING (double click etc.). */
function alreadyDecided(action: AiPendingAction): Result<AiPendingActionDTO> {
  if (action.status === 'EXECUTED' || action.status === 'FAILED') {
    // Idempotent confirm: the second click sees the first one's outcome.
    return ok(toAiPendingActionDTO(action))
  }
  if (action.status === 'EXPIRED') return err(aiPendingActionExpired())
  return err(aiPendingActionNotPending())
}

/** Own action (assistant) — someone else's id answers 404. */
async function loadOwnAction(
  actorId: string,
  workspaceId: string,
  actionId: string,
): Promise<Result<AiPendingAction>> {
  const action = await AiPendingActionRepository.findById(actionId, workspaceId)
  if (!action.ok) return action
  if (action.value.requestedById !== actorId) {
    return err(aiPendingActionNotFound())
  }
  return action
}

export const AiPendingActionService = {
  /** The caller's own proposals (lazily expiring overdue ones first). */
  async list(
    actorId: string,
    workspaceId: string,
    filter: { status?: AiPendingActionStatus; conversationId?: string } = {},
  ): Promise<Result<AiPendingActionDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const expired = await AiPendingActionRepository.expireOverdue(workspaceId)
    if (!expired.ok) return expired

    const actions = await AiPendingActionRepository.listByRequester({
      workspaceId,
      requestedById: actorId,
      ...filter,
    })
    if (!actions.ok) return actions
    return ok(actions.value.map(toAiPendingActionDTO))
  },

  /**
   * Runs a proposed write after the human clicked "Confirmar". Everything is
   * re-checked on the server (owner, status, expiry, double confirmation,
   * agent mode, module and permission) and `args` are parsed again. The
   * `PENDING → EXECUTED` claim is a conditional update, so two concurrent
   * confirms never execute twice — the loser gets the winner's outcome.
   */
  async confirm(
    actorId: string,
    workspaceId: string,
    actionId: string,
    dto: ConfirmAiPendingActionDTO,
    now: Date = new Date(),
  ): Promise<Result<AiPendingActionDTO>> {
    const access = await resolveToolAccess(actorId, workspaceId)
    if (!access.ok) return access

    const action = await loadOwnAction(actorId, workspaceId, actionId)
    if (!action.ok) return action
    if (action.value.status !== 'PENDING') return alreadyDecided(action.value)

    if (action.value.expiresAt.getTime() <= now.getTime()) {
      const expired = await AiPendingActionRepository.transitionFromPending(
        actionId,
        { status: 'EXPIRED' },
      )
      if (!expired.ok) return expired
      return err(aiPendingActionExpired())
    }

    if (action.value.requiresDoubleConfirm && dto.doubleConfirmed !== true) {
      return err(aiDoubleConfirmationRequired())
    }
    if (!access.value.agentModeEnabled) return err(aiAgentModeDisabled())

    const tool = findTool(action.value.toolName)
    if (!tool || !isToolAllowed(tool, access.value, 'AGENT')) {
      return err(aiToolNotAllowed())
    }

    const claimed = await AiPendingActionRepository.transitionFromPending(
      actionId,
      { status: 'EXECUTED', decidedById: actorId, decidedAt: now },
    )
    if (!claimed.ok) return claimed
    if (!claimed.value) {
      const current = await AiPendingActionRepository.findById(
        actionId,
        workspaceId,
      )
      if (!current.ok) return current
      return alreadyDecided(current.value)
    }

    const executed = await executeClaimedAction(claimed.value, tool, {
      ctx: { workspaceId, actorId, source: 'assistant' },
      deciderId: actorId,
    })
    if (!executed.ok) return executed

    logger.info(
      'steel_ai.action_confirmed',
      logFields(
        { component: 'AiPendingActionService', workspaceId, actionId },
        { toolName: action.value.toolName, status: executed.value.status },
      ),
    )

    return ok(toAiPendingActionDTO(executed.value))
  },

  /** Discards a proposal; the model learns it on the next turn. */
  async cancel(
    actorId: string,
    workspaceId: string,
    actionId: string,
    now: Date = new Date(),
  ): Promise<Result<AiPendingActionDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const action = await loadOwnAction(actorId, workspaceId, actionId)
    if (!action.ok) return action

    const canceled = await AiPendingActionRepository.transitionFromPending(
      actionId,
      { status: 'CANCELED', decidedById: actorId, decidedAt: now },
    )
    if (!canceled.ok) return canceled
    if (!canceled.value) return err(aiPendingActionNotPending())

    auditMutation({
      entity: 'ai_pending_action',
      action: 'cancel',
      actorId,
      targetId: actionId,
      meta: { workspaceId, toolName: action.value.toolName },
    })

    await appendDecision(canceled.value, {
      status: 'canceled',
      actionId,
      note: 'O usuário cancelou esta ação; nada foi alterado.',
    })

    return ok(toAiPendingActionDTO(canceled.value))
  },
}
