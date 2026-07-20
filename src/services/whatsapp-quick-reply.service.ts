import { auditMutation } from '@/lib/axiom/audit'
import { whatsappQuickReplyNotFound } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { toWhatsAppQuickReplyDTO } from '@/src/mappers/whatsapp-quick-reply.mapper'
import { WhatsAppQuickReplyRepository } from '@/src/repositories/whatsapp-quick-reply.repository'
import type {
  CreateWhatsAppQuickReplyDTO,
  UpdateWhatsAppQuickReplyDTO,
} from '@/src/schemas/whatsapp-quick-reply.schema'
import type { WhatsAppQuickReplyDTO } from '@/types/whatsapp-quick-reply'
import { assertMember } from './authz'

export const WhatsAppQuickReplyService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<WhatsAppQuickReplyDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result =
      await WhatsAppQuickReplyRepository.listByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(result.value.map(toWhatsAppQuickReplyDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateWhatsAppQuickReplyDTO,
  ): Promise<Result<WhatsAppQuickReplyDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await WhatsAppQuickReplyRepository.create({
      workspaceId,
      shortcut: dto.shortcut,
      title: dto.title,
      body: dto.body,
      mediaUrl: dto.mediaUrl,
    })
    if (!result.ok) {
      auditMutation({
        entity: 'whatsapp_quick_reply',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'whatsapp_quick_reply',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toWhatsAppQuickReplyDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    id: string,
    dto: UpdateWhatsAppQuickReplyDTO,
  ): Promise<Result<WhatsAppQuickReplyDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await WhatsAppQuickReplyRepository.findById(
      id,
      workspaceId,
    )
    if (!existing.ok) return existing
    if (!existing.value) return err(whatsappQuickReplyNotFound())

    const result = await WhatsAppQuickReplyRepository.update(id, dto)
    if (!result.ok) return result

    auditMutation({
      entity: 'whatsapp_quick_reply',
      action: 'update',
      actorId,
      targetId: id,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toWhatsAppQuickReplyDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    id: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await WhatsAppQuickReplyRepository.findById(
      id,
      workspaceId,
    )
    if (!existing.ok) return existing
    if (!existing.value) return err(whatsappQuickReplyNotFound())

    const result = await WhatsAppQuickReplyRepository.delete(id)
    if (!result.ok) return result

    auditMutation({
      entity: 'whatsapp_quick_reply',
      action: 'delete',
      actorId,
      targetId: id,
    })

    return ok(undefined)
  },
}
