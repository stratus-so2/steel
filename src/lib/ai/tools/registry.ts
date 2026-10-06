import type { AiPendingAction, ModuleKind, Prisma } from '@prisma/client'
import { logFields } from '@/lib/axiom/log-fields'
import { logger } from '@/lib/axiom/logger'
import {
  type AppError,
  aiToolNotAllowed,
  appError,
} from '@/src/errors/app-error'
import { can, type PermissionMap } from '@/src/lib/permissions'
import { err, ok, type Result } from '@/src/lib/result'
import { AiPendingActionRepository } from '@/src/repositories/ai-pending-action.repository'
import { WorkspaceAiSettingsRepository } from '@/src/repositories/ai-settings.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { assertMember } from '@/src/services/authz'
import type { AiToolSpec } from '../types'
import { STEEL_AI_TOOLS } from './index'
import {
  compactToolSpec,
  FIND_TOOLS_LABEL,
  FIND_TOOLS_TOOL_NAME,
} from './selection'
import {
  serializeToolResult,
  TOOL_OUTPUT_MAX_BYTES,
  type ToolResultPayload,
} from './tool-result'
import type { AiToolContext, AiToolOutput, AnySteelAiTool } from './types'

/**
 * Runtime of the Steel AI tools: what the model may see (mode × module ×
 * RBAC × agent-mode switch), running read tools and turning write tools
 * into AiPendingActions. Shared by the assistant and Steel Agents.
 */

export type SteelAiMode = 'EXPLORE' | 'AGENT'

/** A pending action stays confirmable for 30 minutes. */
export const PENDING_ACTION_TTL_MS = 30 * 60_000

/** Everything the filter needs about the caller and the workspace. */
export interface AiToolAccess {
  /** Modules enabled in the workspace. */
  modules: ModuleKind[]
  /** OWNER/ADMIN — bypass the RBAC matrix, like `assertMember`. */
  isPrivileged: boolean
  permissions: PermissionMap | null
  /** Workspace kill switch for write tools. */
  agentModeEnabled: boolean
}

const TOOL_NAME = /^[a-z][a-z0-9_]{1,63}$/

/** Problems in a tool list (empty = valid). */
export function validateToolRegistry(
  tools: readonly AnySteelAiTool[],
): string[] {
  const problems: string[] = []
  const seen = new Set<string>()
  for (const tool of tools) {
    if (!TOOL_NAME.test(tool.name)) {
      problems.push(`Tool "${tool.name}" must be snake_case (≤ 64 chars)`)
    }
    if (seen.has(tool.name)) {
      problems.push(`Duplicate tool name "${tool.name}"`)
    }
    seen.add(tool.name)
    if (tool.kind !== 'READ' && typeof tool.preview !== 'function') {
      problems.push(`Write tool "${tool.name}" must implement preview()`)
    }
    if (tool.parameters.type !== 'object') {
      problems.push(`Tool "${tool.name}" parameters must be an object schema`)
    }
  }
  return problems
}

export function assertValidToolRegistry(
  tools: readonly AnySteelAiTool[],
): void {
  const problems = validateToolRegistry(tools)
  if (problems.length > 0) {
    throw new Error(`Invalid Steel AI tool registry: ${problems.join('; ')}`)
  }
}

// Fail fast at load time: a duplicated name or a write tool without
// preview would otherwise only show up when the model calls it.
assertValidToolRegistry(STEEL_AI_TOOLS)

/** Whether the model may be offered `tool` in `mode` for this caller. */
export function isToolAllowed(
  tool: AnySteelAiTool,
  access: AiToolAccess,
  mode: SteelAiMode,
): boolean {
  if (tool.kind !== 'READ') {
    if (mode !== 'AGENT' || !access.agentModeEnabled) return false
  }
  if (tool.module && !access.modules.includes(tool.module)) return false
  if (tool.permission && !access.isPrivileged) {
    if (
      !access.permissions ||
      !can(access.permissions, tool.permission.resource, tool.permission.action)
    ) {
      return false
    }
  }
  return true
}

/** Tools the model is shown: EXPLORE ⇒ READ only; AGENT adds writes. */
export function availableTools(
  access: AiToolAccess,
  mode: SteelAiMode,
  tools: readonly AnySteelAiTool[] = STEEL_AI_TOOLS,
): AnySteelAiTool[] {
  return tools.filter((tool) => isToolAllowed(tool, access, mode))
}

export function findTool(
  name: string,
  tools: readonly AnySteelAiTool[] = STEEL_AI_TOOLS,
): AnySteelAiTool | undefined {
  return tools.find((tool) => tool.name === name)
}

/** Label/module for the transcript; unknown (removed) tools keep the name. */
export function toolMeta(
  name: string,
  tools: readonly AnySteelAiTool[] = STEEL_AI_TOOLS,
): { label: string; module: ModuleKind | null } {
  if (name === FIND_TOOLS_TOOL_NAME) {
    return { label: FIND_TOOLS_LABEL, module: null }
  }
  const tool = findTool(name, tools)
  return tool
    ? { label: tool.label, module: tool.module }
    : { label: name, module: null }
}

/**
 * Provider-neutral specs (what the adapters send to the model), with the
 * JSON Schema compacted — see `compactToolSpec`. To send only the tools a
 * round needs, pick them first with `selectSteelAiTools`.
 */
export function toToolSpecs(tools: readonly AnySteelAiTool[]): AiToolSpec[] {
  return tools.map(compactToolSpec)
}

/**
 * Resolves the caller's access in one go: membership (403 for strangers and
 * suspended workspaces), enabled modules, RBAC matrix and agent-mode switch.
 */
export async function resolveToolAccess(
  actorId: string,
  workspaceId: string,
): Promise<Result<AiToolAccess>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership

  const [modules, settings] = await Promise.all([
    WorkspaceModuleAccessRepository.listByWorkspace(workspaceId),
    WorkspaceAiSettingsRepository.findByWorkspace(workspaceId),
  ])
  if (!modules.ok) return modules
  if (!settings.ok) return settings

  return ok({
    modules: modules.value.filter((m) => m.enabled).map((m) => m.module),
    isPrivileged: membership.value.isPrivileged,
    permissions: membership.value.permissions,
    agentModeEnabled: settings.value?.agentModeEnabled ?? true,
  })
}

export type AiToolRunResult =
  | { ok: true; output: AiToolOutput; content: string }
  | { ok: false; error: AppError; content: string }

function failure(error: AppError): AiToolRunResult {
  return {
    ok: false,
    error,
    content: serializeToolResult({
      status: 'error',
      error: { code: error.code, message: error.message },
    }),
  }
}

function unexpected(tool: AnySteelAiTool, cause: unknown): AppError {
  logger.error(
    'steel_ai.tool_threw',
    logFields(
      {
        component: 'SteelAiToolRegistry',
        message: cause instanceof Error ? cause.message : String(cause),
      },
      { toolName: tool.name },
    ),
  )
  return appError(
    'INTERNAL_SERVER_ERROR',
    'Falha inesperada ao executar a ferramenta',
  )
}

/**
 * `parse` → `execute`, never throws. The `content` is the JSON returned to
 * the model, capped at ~20 KB. Callers decide whether the tool may run
 * (filter + confirmation); this only executes.
 */
export async function runTool(
  tool: AnySteelAiTool,
  ctx: AiToolContext,
  rawArgs: Record<string, unknown>,
): Promise<AiToolRunResult> {
  const parsed = tool.parse(rawArgs)
  if (!parsed.ok) return failure(parsed.error)

  try {
    const result = await tool.execute(ctx, parsed.value)
    if (!result.ok) return failure(result.error)
    const payload: ToolResultPayload = {
      status: 'done',
      summary: result.value.summary,
      data: result.value.data,
    }
    return {
      ok: true,
      output: result.value,
      content: serializeToolResult(payload, TOOL_OUTPUT_MAX_BYTES),
    }
  } catch (cause) {
    return failure(unexpected(tool, cause))
  }
}

/** Runs a READ tool; refuses any write tool (those need confirmation). */
export async function runReadTool(
  tool: AnySteelAiTool,
  ctx: AiToolContext,
  rawArgs: Record<string, unknown>,
): Promise<AiToolRunResult> {
  if (tool.kind !== 'READ') return failure(aiToolNotAllowed())
  return runTool(tool, ctx, rawArgs)
}

/**
 * Write tool proposed by the model: `parse` → `preview` (no mutation) →
 * AiPendingAction(PENDING, expires in 30 min, DELETE needs a double
 * confirmation). Nothing is executed here.
 */
export async function proposeWriteTool(
  tool: AnySteelAiTool,
  ctx: AiToolContext,
  rawArgs: Record<string, unknown>,
  origin: {
    conversationId?: string | null
    toolCallId?: string | null
    agentRunId?: string | null
  } = {},
  now: Date = new Date(),
): Promise<Result<AiPendingAction>> {
  if (tool.kind === 'READ' || !tool.preview) return err(aiToolNotAllowed())

  const parsed = tool.parse(rawArgs)
  if (!parsed.ok) return parsed

  let preview: Awaited<ReturnType<NonNullable<AnySteelAiTool['preview']>>>
  try {
    preview = await tool.preview(ctx, parsed.value)
  } catch (cause) {
    return err(unexpected(tool, cause))
  }
  if (!preview.ok) return preview

  return AiPendingActionRepository.create({
    workspaceId: ctx.workspaceId,
    requestedById: ctx.source === 'assistant' ? ctx.actorId : null,
    conversationId: origin.conversationId ?? null,
    agentRunId: origin.agentRunId ?? null,
    toolName: tool.name,
    toolCallId: origin.toolCallId ?? null,
    kind: tool.kind,
    module: tool.module,
    args: parsed.value as Prisma.InputJsonValue,
    preview: preview.value as unknown as Prisma.InputJsonValue,
    requiresDoubleConfirm: tool.kind === 'DELETE',
    expiresAt: new Date(now.getTime() + PENDING_ACTION_TTL_MS),
  })
}
