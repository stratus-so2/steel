import type { AiMemory, AiMemorySource, AiScope } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { logFields } from '@/lib/axiom/log-fields'
import { logger } from '@/lib/axiom/logger'
import { conflict, forbidden, validationError } from '@/src/errors'
import { aiMemoryDisabled, aiMemoryNotFound } from '@/src/errors/app-error'
import {
  isNearDuplicateMemory,
  memoryGuardProblem,
} from '@/src/lib/ai/context/memory-guard'
import type { AiToolContext } from '@/src/lib/ai/tools/types'
import { err, ok, type Result } from '@/src/lib/result'
import { toAiMemoryDTO } from '@/src/mappers/ai-memory.mapper'
import { AiMemoryRepository } from '@/src/repositories/ai-memory.repository'
import { WorkspaceAiSettingsRepository } from '@/src/repositories/ai-settings.repository'
import type {
  CreateAiMemoryDTO,
  ListAiMemoriesQueryDTO,
  MemorySaveArgs,
  UpdateAiMemoryDTO,
} from '@/src/schemas/ai-memory.schema'
import type { AiMemoryDTO, AiMemoryListDTO } from '@/types/ai-memory'
import { assertMember, type MembershipContext } from './authz'

/**
 * Steel AI memory: short facts kept per workspace (WORKSPACE, shared) or per
 * user (PERSONAL). The model saves them by itself (`memory_save`, no
 * confirmation — it is metadata, not business data) and every member
 * reviews, edits and deletes them in the Memória tab. Workspace memories
 * are managed by OWNER/ADMIN; personal ones only by their user.
 * `WorkspaceAiSettings.memoryEnabled` off: nothing is saved or read back,
 * but existing memories can still be reviewed and deleted.
 */

const FORBIDDEN_WORKSPACE =
  'Só administradores gerenciam a memória do workspace.'

type Viewer = { actorId: string; canManageWorkspace: boolean }

async function memoryEnabled(workspaceId: string): Promise<Result<boolean>> {
  const settings =
    await WorkspaceAiSettingsRepository.findByWorkspace(workspaceId)
  if (!settings.ok) return settings
  return ok(settings.value?.memoryEnabled ?? true)
}

/** Personal memories of someone else do not exist for the caller. */
function authorizeRow(
  row: AiMemory,
  actorId: string,
  membership: MembershipContext,
): Result<true> {
  if (row.scope === 'PERSONAL') {
    return row.userId === actorId ? ok(true) : err(aiMemoryNotFound())
  }
  return membership.isPrivileged
    ? ok(true)
    : err(forbidden(FORBIDDEN_WORKSPACE))
}

/**
 * Near-identical fact already known in the target scope. A personal fact
 * that repeats a workspace one is also a duplicate (the model reads both).
 */
async function findDuplicate(
  workspaceId: string,
  actorId: string,
  scope: AiScope,
  content: string,
): Promise<Result<AiMemory | null>> {
  const rows = await AiMemoryRepository.listVisible(workspaceId, actorId)
  if (!rows.ok) return rows
  const candidates = rows.value.filter(
    (row) => scope === 'PERSONAL' || row.scope === 'WORKSPACE',
  )
  return ok(
    candidates.find((row) => isNearDuplicateMemory(row.content, content)) ??
      null,
  )
}

async function insert(
  actorId: string,
  workspaceId: string,
  input: {
    scope: AiScope
    content: string
    source: AiMemorySource
    sourceConversationId: string | null
  },
): Promise<Result<AiMemory>> {
  const created = await AiMemoryRepository.create({
    workspaceId,
    scope: input.scope,
    userId: input.scope === 'PERSONAL' ? actorId : null,
    content: input.content,
    source: input.source,
    sourceConversationId: input.sourceConversationId,
    createdById: actorId,
  })
  if (!created.ok) return created
  auditMutation({
    entity: 'ai_memory',
    action: 'create',
    actorId,
    targetId: created.value.id,
    meta: { workspaceId, scope: input.scope, source: input.source },
  })
  return created
}

async function remove(
  actorId: string,
  workspaceId: string,
  memoryId: string,
  via: 'tab' | 'model',
): Promise<Result<AiMemory>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership
  const row = await AiMemoryRepository.findById(memoryId, workspaceId)
  if (!row.ok) return row
  const allowed = authorizeRow(row.value, actorId, membership.value)
  if (!allowed.ok) return allowed

  const deleted = await AiMemoryRepository.softDelete(memoryId)
  if (!deleted.ok) return deleted
  auditMutation({
    entity: 'ai_memory',
    action: 'delete',
    actorId,
    targetId: memoryId,
    meta: { workspaceId, scope: row.value.scope, via },
  })
  return deleted
}

export const AiMemoryService = {
  /** The Memória tab: workspace and personal facts, newest first. */
  async list(
    actorId: string,
    workspaceId: string,
    query: ListAiMemoriesQueryDTO = {},
  ): Promise<Result<AiMemoryListDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership
    const [enabled, rows] = await Promise.all([
      memoryEnabled(workspaceId),
      AiMemoryRepository.listVisible(workspaceId, actorId, { q: query.q }),
    ])
    if (!enabled.ok) return enabled
    if (!rows.ok) return rows

    const viewer: Viewer = {
      actorId,
      canManageWorkspace: membership.value.isPrivileged,
    }
    const dtos = rows.value.map((row) => toAiMemoryDTO(row, viewer))
    return ok({
      memoryEnabled: enabled.value,
      canManageWorkspace: viewer.canManageWorkspace,
      workspace: dtos.filter((m) => m.scope === 'WORKSPACE'),
      personal: dtos.filter((m) => m.scope === 'PERSONAL'),
    })
  },

  /** "Adicionar" in the tab (source MANUAL). */
  async create(
    actorId: string,
    workspaceId: string,
    input: CreateAiMemoryDTO,
  ): Promise<Result<AiMemoryDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership
    if (input.scope === 'WORKSPACE' && !membership.value.isPrivileged) {
      return err(forbidden(FORBIDDEN_WORKSPACE))
    }
    const enabled = await memoryEnabled(workspaceId)
    if (!enabled.ok) return enabled
    if (!enabled.value) return err(aiMemoryDisabled())

    const problem = memoryGuardProblem(input.content)
    if (problem) return err(validationError(problem))
    const duplicate = await findDuplicate(
      workspaceId,
      actorId,
      input.scope,
      input.content,
    )
    if (!duplicate.ok) return duplicate
    if (duplicate.value) {
      return err(conflict('O Steel AI já lembra de um fato igual a este.'))
    }

    const created = await insert(actorId, workspaceId, {
      scope: input.scope,
      content: input.content,
      source: 'MANUAL',
      sourceConversationId: null,
    })
    if (!created.ok) return created
    return ok(
      toAiMemoryDTO(created.value, {
        actorId,
        canManageWorkspace: membership.value.isPrivileged,
      }),
    )
  },

  async update(
    actorId: string,
    workspaceId: string,
    memoryId: string,
    input: UpdateAiMemoryDTO,
  ): Promise<Result<AiMemoryDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership
    const row = await AiMemoryRepository.findById(memoryId, workspaceId)
    if (!row.ok) return row
    const allowed = authorizeRow(row.value, actorId, membership.value)
    if (!allowed.ok) return allowed
    const problem = memoryGuardProblem(input.content)
    if (problem) return err(validationError(problem))

    const updated = await AiMemoryRepository.updateContent(
      memoryId,
      input.content,
    )
    if (!updated.ok) return updated
    auditMutation({
      entity: 'ai_memory',
      action: 'update',
      actorId,
      targetId: memoryId,
      meta: { workspaceId, scope: row.value.scope },
    })
    return ok(
      toAiMemoryDTO(updated.value, {
        actorId,
        canManageWorkspace: membership.value.isPrivileged,
      }),
    )
  },

  async delete(
    actorId: string,
    workspaceId: string,
    memoryId: string,
  ): Promise<Result<{ id: string }>> {
    const deleted = await remove(actorId, workspaceId, memoryId, 'tab')
    if (!deleted.ok) return deleted
    return ok({ id: memoryId })
  },

  /**
   * `memory_save`: runs without confirmation. WORKSPACE only for
   * OWNER/ADMIN (anyone else gets a personal memory, `downgraded`); a
   * near-identical fact is not stored twice (`duplicate`).
   */
  async saveFromModel(
    ctx: AiToolContext,
    args: MemorySaveArgs,
  ): Promise<
    Result<{
      memory: AiMemory
      action: 'saved' | 'duplicate'
      downgraded: boolean
    }>
  > {
    const membership = await assertMember(ctx.actorId, ctx.workspaceId)
    if (!membership.ok) return membership
    const enabled = await memoryEnabled(ctx.workspaceId)
    if (!enabled.ok) return enabled
    if (!enabled.value) return err(aiMemoryDisabled())

    const problem = memoryGuardProblem(args.content)
    if (problem) return err(validationError(problem))

    const downgraded =
      args.scope === 'WORKSPACE' && !membership.value.isPrivileged
    const scope: AiScope = downgraded ? 'PERSONAL' : args.scope
    const duplicate = await findDuplicate(
      ctx.workspaceId,
      ctx.actorId,
      scope,
      args.content,
    )
    if (!duplicate.ok) return duplicate
    if (duplicate.value) {
      return ok({ memory: duplicate.value, action: 'duplicate', downgraded })
    }

    const created = await insert(ctx.actorId, ctx.workspaceId, {
      scope,
      content: args.content,
      source: 'AUTO',
      sourceConversationId: ctx.conversationId ?? null,
    })
    if (!created.ok) return created
    logger.info(
      'steel_ai.memory_saved',
      logFields(
        {
          component: 'AiMemoryService',
          workspaceId: ctx.workspaceId,
          conversationId: ctx.conversationId,
        },
        { scope, downgraded },
      ),
    )
    return ok({ memory: created.value, action: 'saved', downgraded })
  },

  /** `memory_forget`: same rules as deleting in the tab. */
  async forgetFromModel(
    ctx: AiToolContext,
    memoryId: string,
  ): Promise<Result<AiMemory>> {
    return remove(ctx.actorId, ctx.workspaceId, memoryId, 'model')
  },

  /**
   * Facts for the system prompt, newest first (null when memory is off).
   * The caller is an already-authorized chat turn.
   */
  async forPrompt(ctx: AiToolContext): Promise<Result<AiMemory[] | null>> {
    const enabled = await memoryEnabled(ctx.workspaceId)
    if (!enabled.ok) return enabled
    if (!enabled.value) return ok(null)
    return AiMemoryRepository.listVisible(ctx.workspaceId, ctx.actorId, {
      take: 100,
    })
  },

  /** Stamps `lastUsedAt` on the memories a prompt included. */
  async markUsed(ids: string[]): Promise<void> {
    const touched = await AiMemoryRepository.touchUsed(ids, new Date())
    if (!touched.ok) {
      logger.warn(
        'steel_ai.memory_touch_failed',
        logFields({
          component: 'AiMemoryService',
          message: touched.error.message,
        }),
      )
    }
  },
}
