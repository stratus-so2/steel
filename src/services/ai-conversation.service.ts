import type { WorkspaceAiSettings } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import {
  aiAgentModeDisabled,
  aiAutopilotDisabled,
  aiDisabled,
  aiModelNotEnabled,
} from '@/src/errors/app-error'
import { type SteelAiMode, toolMeta } from '@/src/lib/ai/tools/registry'
import { err, ok, type Result } from '@/src/lib/result'
import {
  toAiConversationDTO,
  toAiMessageDTOs,
} from '@/src/mappers/ai-conversation.mapper'
import { toEffectiveAiSettings } from '@/src/mappers/ai-settings.mapper'
import { AiAttachmentRepository } from '@/src/repositories/ai-attachment.repository'
import {
  AiConversationRepository,
  AiMessageRepository,
} from '@/src/repositories/ai-conversation.repository'
import { AiPendingActionRepository } from '@/src/repositories/ai-pending-action.repository'
import { WorkspaceAiSettingsRepository } from '@/src/repositories/ai-settings.repository'
import type {
  CreateAiConversationDTO,
  UpdateAiConversationDTO,
} from '@/src/schemas/steel-ai.schema'
import type { AiConversationDTO, AiMessageDTO } from '@/types/steel-ai'
import { isModelUsable } from './ai-settings.service'
import { assertMember } from './authz'

/**
 * Whether `mode` may run under these switches: AGENT and AUTOPILOT need the
 * agent mode; AUTOPILOT also needs `autopilotEnabled` (off by default).
 * TEST never writes, so it only needs the AI itself (like EXPLORE).
 */
export function checkSteelAiMode(
  settings: Pick<
    WorkspaceAiSettings,
    'agentModeEnabled' | 'autopilotEnabled'
  > | null,
  mode: SteelAiMode,
): Result<true> {
  if (mode === 'EXPLORE' || mode === 'TEST') return ok(true)
  if (settings && !settings.agentModeEnabled) return err(aiAgentModeDisabled())
  if (mode === 'AUTOPILOT' && !settings?.autopilotEnabled) {
    return err(aiAutopilotDisabled())
  }
  return ok(true)
}

/**
 * Gate of every Steel AI call: the master switch (`aiEnabled`, on by
 * default) and, when a mode is given, the switches that mode needs.
 */
export async function assertSteelAiEnabled(
  workspaceId: string,
  mode?: SteelAiMode,
): Promise<Result<WorkspaceAiSettings | null>> {
  const settings =
    await WorkspaceAiSettingsRepository.findByWorkspace(workspaceId)
  if (!settings.ok) return settings
  if (settings.value && !settings.value.aiEnabled) return err(aiDisabled())
  if (mode) {
    const allowed = checkSteelAiMode(settings.value, mode)
    if (!allowed.ok) return allowed
  }
  return settings
}

/** Membership + master switch (+ mode switches), in that order. */
async function gate(
  actorId: string,
  workspaceId: string,
  mode?: SteelAiMode,
): Promise<Result<WorkspaceAiSettings | null>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership
  return assertSteelAiEnabled(workspaceId, mode)
}

/** A model the user may pick: in the catalog, enabled and with a provider key. */
function checkModelKey(
  settings: WorkspaceAiSettings | null,
  modelKey: string | null | undefined,
): Result<true> {
  if (!modelKey) return ok(true)
  if (!isModelUsable(toEffectiveAiSettings(settings), modelKey)) {
    return err(aiModelNotEnabled())
  }
  return ok(true)
}

/**
 * Steel AI conversations. Private to their user: every lookup is scoped by
 * workspace **and** owner, so another member gets 404, never 403.
 */
export const AiConversationService = {
  async list(
    actorId: string,
    workspaceId: string,
    q?: string,
  ): Promise<Result<AiConversationDTO[]>> {
    const allowed = await gate(actorId, workspaceId)
    if (!allowed.ok) return allowed

    const result = await AiConversationRepository.listByUser(
      workspaceId,
      actorId,
      q,
    )
    if (!result.ok) return result
    return ok(result.value.map(toAiConversationDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateAiConversationDTO,
  ): Promise<Result<AiConversationDTO>> {
    const allowed = await gate(actorId, workspaceId, dto.mode)
    if (!allowed.ok) return allowed
    const model = checkModelKey(allowed.value, dto.modelKey)
    if (!model.ok) return model

    const created = await AiConversationRepository.create({
      workspaceId,
      userId: actorId,
      title: dto.title || null,
      mode: dto.mode,
      modelKey: dto.modelKey ?? null,
    })
    if (!created.ok) return created

    auditMutation({
      entity: 'ai_conversation',
      action: 'create',
      actorId,
      targetId: created.value.id,
      meta: { workspaceId, mode: dto.mode, modelKey: dto.modelKey ?? null },
    })

    return ok(toAiConversationDTO(created.value))
  },

  async get(
    actorId: string,
    workspaceId: string,
    conversationId: string,
  ): Promise<Result<AiConversationDTO>> {
    const allowed = await gate(actorId, workspaceId)
    if (!allowed.ok) return allowed

    const conversation = await AiConversationRepository.findById(
      conversationId,
      workspaceId,
      actorId,
    )
    if (!conversation.ok) return conversation
    return ok(toAiConversationDTO(conversation.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    conversationId: string,
    dto: UpdateAiConversationDTO,
  ): Promise<Result<AiConversationDTO>> {
    const allowed = await gate(actorId, workspaceId, dto.mode)
    if (!allowed.ok) return allowed

    const conversation = await AiConversationRepository.findById(
      conversationId,
      workspaceId,
      actorId,
    )
    if (!conversation.ok) return conversation

    const model = checkModelKey(allowed.value, dto.modelKey)
    if (!model.ok) return model

    const updated = await AiConversationRepository.update(conversationId, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.mode !== undefined && { mode: dto.mode }),
      ...(dto.modelKey !== undefined && { modelKey: dto.modelKey }),
      ...(dto.pinned !== undefined && {
        pinnedAt: dto.pinned
          ? (conversation.value.pinnedAt ?? new Date())
          : null,
      }),
    })
    if (!updated.ok) return updated

    auditMutation({
      entity: 'ai_conversation',
      action: 'update',
      actorId,
      targetId: conversationId,
      meta: { workspaceId, fields: Object.keys(dto) },
    })

    return ok(toAiConversationDTO(updated.value))
  },

  /** Soft delete — the transcript stays for the retention window. */
  async remove(
    actorId: string,
    workspaceId: string,
    conversationId: string,
  ): Promise<Result<AiConversationDTO>> {
    const allowed = await gate(actorId, workspaceId)
    if (!allowed.ok) return allowed

    const conversation = await AiConversationRepository.findById(
      conversationId,
      workspaceId,
      actorId,
    )
    if (!conversation.ok) return conversation

    const removed = await AiConversationRepository.softDelete(conversationId)
    if (!removed.ok) return removed

    auditMutation({
      entity: 'ai_conversation',
      action: 'delete',
      actorId,
      targetId: conversationId,
      meta: { workspaceId },
    })

    return ok(toAiConversationDTO(conversation.value))
  },

  /** Transcript folded for the chat screen (TOOL rows inside each turn). */
  async listMessages(
    actorId: string,
    workspaceId: string,
    conversationId: string,
  ): Promise<Result<AiMessageDTO[]>> {
    const allowed = await gate(actorId, workspaceId)
    if (!allowed.ok) return allowed

    const conversation = await AiConversationRepository.findById(
      conversationId,
      workspaceId,
      actorId,
    )
    if (!conversation.ok) return conversation

    // Lazy expiry, so overdue proposals render as EXPIRED.
    const expired = await AiPendingActionRepository.expireOverdue(workspaceId)
    if (!expired.ok) return expired

    const [messages, actions, attachments] = await Promise.all([
      AiMessageRepository.listByConversation(conversationId),
      AiPendingActionRepository.listByConversation(conversationId),
      AiAttachmentRepository.listSentByConversation(conversationId),
    ])
    if (!messages.ok) return messages
    if (!actions.ok) return actions
    if (!attachments.ok) return attachments

    return ok(
      toAiMessageDTOs(messages.value, actions.value, toolMeta, {
        workspaceId,
        attachments: attachments.value,
      }),
    )
  },
}
