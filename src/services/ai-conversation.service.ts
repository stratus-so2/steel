import { auditMutation } from '@/lib/axiom/audit'
import { aiAgentModeDisabled } from '@/src/errors/app-error'
import { toolMeta } from '@/src/lib/ai/tools/registry'
import { err, ok, type Result } from '@/src/lib/result'
import {
  toAiConversationDTO,
  toAiMessageDTOs,
} from '@/src/mappers/ai-conversation.mapper'
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
import { assertMember } from './authz'

/** Rejects the AGENT mode when the workspace switched it off. */
export async function assertAgentModeEnabled(
  workspaceId: string,
): Promise<Result<true>> {
  const settings =
    await WorkspaceAiSettingsRepository.findByWorkspace(workspaceId)
  if (!settings.ok) return settings
  if (settings.value && !settings.value.agentModeEnabled) {
    return err(aiAgentModeDisabled())
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
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

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
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    if (dto.mode === 'AGENT') {
      const agent = await assertAgentModeEnabled(workspaceId)
      if (!agent.ok) return agent
    }

    const created = await AiConversationRepository.create({
      workspaceId,
      userId: actorId,
      title: dto.title || null,
      mode: dto.mode,
    })
    if (!created.ok) return created

    auditMutation({
      entity: 'ai_conversation',
      action: 'create',
      actorId,
      targetId: created.value.id,
      meta: { workspaceId, mode: dto.mode },
    })

    return ok(toAiConversationDTO(created.value))
  },

  async get(
    actorId: string,
    workspaceId: string,
    conversationId: string,
  ): Promise<Result<AiConversationDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

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
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const conversation = await AiConversationRepository.findById(
      conversationId,
      workspaceId,
      actorId,
    )
    if (!conversation.ok) return conversation

    if (dto.mode === 'AGENT') {
      const agent = await assertAgentModeEnabled(workspaceId)
      if (!agent.ok) return agent
    }

    const updated = await AiConversationRepository.update(conversationId, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.mode !== undefined && { mode: dto.mode }),
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
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

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
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const conversation = await AiConversationRepository.findById(
      conversationId,
      workspaceId,
      actorId,
    )
    if (!conversation.ok) return conversation

    // Lazy expiry, so overdue proposals render as EXPIRED.
    const expired = await AiPendingActionRepository.expireOverdue(workspaceId)
    if (!expired.ok) return expired

    const [messages, actions] = await Promise.all([
      AiMessageRepository.listByConversation(conversationId),
      AiPendingActionRepository.listByConversation(conversationId),
    ])
    if (!messages.ok) return messages
    if (!actions.ok) return actions

    return ok(
      toAiMessageDTOs(messages.value, actions.value, (name) => toolMeta(name)),
    )
  },
}
