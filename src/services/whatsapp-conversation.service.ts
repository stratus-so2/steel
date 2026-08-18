import { auditMutation } from '@/lib/axiom/audit'
import {
  badRequest,
  whatsappConnectionNotFound,
  whatsappContactNotFound,
  whatsappConversationNotFound,
} from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { publishWhatsAppEvent } from '@/src/lib/whatsapp/realtime'
import { toWhatsAppConversationDTO } from '@/src/mappers/whatsapp-conversation.mapper'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WhatsAppConnectionRepository } from '@/src/repositories/whatsapp-connection.repository'
import { WhatsAppContactRepository } from '@/src/repositories/whatsapp-contact.repository'
import { WhatsAppConversationRepository } from '@/src/repositories/whatsapp-conversation.repository'
import type { StartWhatsAppConversationDTO } from '@/src/schemas/whatsapp-conversation.schema'
import type {
  WhatsAppAssignableMemberDTO,
  WhatsAppConversationDTO,
} from '@/types/whatsapp-conversation'
import { assertMember } from './authz'

export const WhatsAppConversationService = {
  async list(
    actorId: string,
    workspaceId: string,
    filters: {
      status?: 'NEW' | 'IN_PROGRESS' | 'CLOSED'
      archived?: boolean
      connectionId?: string
    } = {},
  ): Promise<Result<WhatsAppConversationDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await WhatsAppConversationRepository.listByWorkspace(
      workspaceId,
      filters,
    )
    if (!result.ok) return result

    return ok(result.value.map(toWhatsAppConversationDTO))
  },

  async start(
    actorId: string,
    workspaceId: string,
    dto: StartWhatsAppConversationDTO,
  ): Promise<Result<WhatsAppConversationDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const contact = await WhatsAppContactRepository.findById(
      dto.contactId,
      workspaceId,
    )
    if (!contact.ok) return contact
    if (!contact.value) return err(whatsappContactNotFound())

    const connection = await WhatsAppConnectionRepository.findById(
      dto.connectionId,
      workspaceId,
    )
    if (!connection.ok) return connection
    if (!connection.value) return err(whatsappConnectionNotFound())

    const existing = await WhatsAppConversationRepository.findActiveByContact(
      workspaceId,
      dto.contactId,
    )
    if (!existing.ok) return existing

    let conversationId: string
    if (existing.value) {
      conversationId = existing.value.id
    } else {
      const created = await WhatsAppConversationRepository.create({
        workspaceId,
        connectionId: dto.connectionId,
        contactId: dto.contactId,
        status: 'NEW',
      })
      if (!created.ok) return created
      conversationId = created.value.id

      auditMutation({
        entity: 'whatsapp_conversation',
        action: 'create',
        actorId,
        targetId: conversationId,
      })
    }

    const fresh = await WhatsAppConversationRepository.findById(
      conversationId,
      workspaceId,
    )
    if (!fresh.ok) return fresh
    if (!fresh.value) return err(whatsappConversationNotFound())

    const conversationDto = toWhatsAppConversationDTO(fresh.value)
    await publishWhatsAppEvent(workspaceId, {
      type: 'conversation.updated',
      conversation: conversationDto,
    })

    return ok(conversationDto)
  },

  async get(
    actorId: string,
    workspaceId: string,
    id: string,
  ): Promise<Result<WhatsAppConversationDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await WhatsAppConversationRepository.findById(
      id,
      workspaceId,
    )
    if (!result.ok) return result
    if (!result.value) return err(whatsappConversationNotFound())

    return ok(toWhatsAppConversationDTO(result.value))
  },

  async markRead(
    actorId: string,
    workspaceId: string,
    id: string,
  ): Promise<Result<WhatsAppConversationDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await WhatsAppConversationRepository.findById(
      id,
      workspaceId,
    )
    if (!existing.ok) return existing
    if (!existing.value) return err(whatsappConversationNotFound())

    if (existing.value.unreadCount === 0) {
      return ok(toWhatsAppConversationDTO(existing.value))
    }

    const updated = await WhatsAppConversationRepository.update(id, {
      unreadCount: 0,
    })
    if (!updated.ok) return updated

    const fresh = await WhatsAppConversationRepository.findById(id, workspaceId)
    if (!fresh.ok) return fresh
    if (!fresh.value) return err(whatsappConversationNotFound())

    const dto = toWhatsAppConversationDTO(fresh.value)
    await publishWhatsAppEvent(workspaceId, {
      type: 'conversation.updated',
      conversation: dto,
    })

    return ok(dto)
  },

  async removeFromAi(
    actorId: string,
    workspaceId: string,
    id: string,
  ): Promise<Result<WhatsAppConversationDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await WhatsAppConversationRepository.findById(
      id,
      workspaceId,
    )
    if (!existing.ok) return existing
    if (!existing.value) return err(whatsappConversationNotFound())

    const updated = await WhatsAppConversationRepository.update(id, {
      aiActive: false,
      aiHandoff: true,
      status: 'IN_PROGRESS',
    })
    if (!updated.ok) return updated

    const fresh = await WhatsAppConversationRepository.findById(id, workspaceId)
    if (!fresh.ok) return fresh
    if (!fresh.value) return err(whatsappConversationNotFound())

    const dto = toWhatsAppConversationDTO(fresh.value)
    await publishWhatsAppEvent(workspaceId, {
      type: 'conversation.updated',
      conversation: dto,
    })

    auditMutation({
      entity: 'whatsapp_conversation',
      action: 'update',
      actorId,
      targetId: id,
      meta: { aiHandoff: true },
    })

    return ok(dto)
  },

  async resumeAi(
    actorId: string,
    workspaceId: string,
    id: string,
  ): Promise<Result<WhatsAppConversationDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await WhatsAppConversationRepository.findById(
      id,
      workspaceId,
    )
    if (!existing.ok) return existing
    if (!existing.value) return err(whatsappConversationNotFound())

    const updated = await WhatsAppConversationRepository.update(id, {
      aiActive: true,
      aiHandoff: false,
    })
    if (!updated.ok) return updated

    const fresh = await WhatsAppConversationRepository.findById(id, workspaceId)
    if (!fresh.ok) return fresh
    if (!fresh.value) return err(whatsappConversationNotFound())

    const dto = toWhatsAppConversationDTO(fresh.value)
    await publishWhatsAppEvent(workspaceId, {
      type: 'conversation.updated',
      conversation: dto,
    })

    auditMutation({
      entity: 'whatsapp_conversation',
      action: 'update',
      actorId,
      targetId: id,
      meta: { aiHandoff: false },
    })

    return ok(dto)
  },

  async setPinned(
    actorId: string,
    workspaceId: string,
    id: string,
    pinned: boolean,
  ): Promise<Result<WhatsAppConversationDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await WhatsAppConversationRepository.findById(
      id,
      workspaceId,
    )
    if (!existing.ok) return existing
    if (!existing.value) return err(whatsappConversationNotFound())

    const updated = await WhatsAppConversationRepository.update(id, {
      pinnedAt: pinned ? new Date() : null,
    })
    if (!updated.ok) return updated

    const fresh = await WhatsAppConversationRepository.findById(id, workspaceId)
    if (!fresh.ok) return fresh
    if (!fresh.value) return err(whatsappConversationNotFound())

    const dto = toWhatsAppConversationDTO(fresh.value)
    await publishWhatsAppEvent(workspaceId, {
      type: 'conversation.updated',
      conversation: dto,
    })

    return ok(dto)
  },

  async setArchived(
    actorId: string,
    workspaceId: string,
    id: string,
    archived: boolean,
  ): Promise<Result<WhatsAppConversationDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await WhatsAppConversationRepository.findById(
      id,
      workspaceId,
    )
    if (!existing.ok) return existing
    if (!existing.value) return err(whatsappConversationNotFound())

    const updated = await WhatsAppConversationRepository.update(id, {
      archivedAt: archived ? new Date() : null,
    })
    if (!updated.ok) return updated

    const fresh = await WhatsAppConversationRepository.findById(id, workspaceId)
    if (!fresh.ok) return fresh
    if (!fresh.value) return err(whatsappConversationNotFound())

    const dto = toWhatsAppConversationDTO(fresh.value)
    await publishWhatsAppEvent(workspaceId, {
      type: 'conversation.updated',
      conversation: dto,
    })

    auditMutation({
      entity: 'whatsapp_conversation',
      action: 'update',
      actorId,
      targetId: id,
      meta: { archived },
    })

    return ok(dto)
  },

  async remove(
    actorId: string,
    workspaceId: string,
    id: string,
  ): Promise<Result<{ id: string }>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await WhatsAppConversationRepository.findById(
      id,
      workspaceId,
    )
    if (!existing.ok) return existing
    if (!existing.value) return err(whatsappConversationNotFound())

    const updated = await WhatsAppConversationRepository.update(id, {
      deletedAt: new Date(),
    })
    if (!updated.ok) return updated

    await publishWhatsAppEvent(workspaceId, {
      type: 'conversation.deleted',
      conversationId: id,
    })

    auditMutation({
      entity: 'whatsapp_conversation',
      action: 'delete',
      actorId,
      targetId: id,
    })

    return ok({ id })
  },

  async clear(
    actorId: string,
    workspaceId: string,
    id: string,
  ): Promise<Result<WhatsAppConversationDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await WhatsAppConversationRepository.findById(
      id,
      workspaceId,
    )
    if (!existing.ok) return existing
    if (!existing.value) return err(whatsappConversationNotFound())

    const updated = await WhatsAppConversationRepository.update(id, {
      clearedAt: new Date(),
      lastMessageAt: null,
    })
    if (!updated.ok) return updated

    const fresh = await WhatsAppConversationRepository.findById(id, workspaceId)
    if (!fresh.ok) return fresh
    if (!fresh.value) return err(whatsappConversationNotFound())

    const dto = toWhatsAppConversationDTO(fresh.value)
    await publishWhatsAppEvent(workspaceId, {
      type: 'conversation.updated',
      conversation: dto,
    })

    auditMutation({
      entity: 'whatsapp_conversation',
      action: 'update',
      actorId,
      targetId: id,
      meta: { cleared: true },
    })

    return ok(dto)
  },

  async listAssignableMembers(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<WhatsAppAssignableMemberDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result =
      await MembershipRepository.listWithUserByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(
      result.value.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
      })),
    )
  },

  async assign(
    actorId: string,
    workspaceId: string,
    id: string,
    assignedUserId: string | null,
  ): Promise<Result<WhatsAppConversationDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await WhatsAppConversationRepository.findById(
      id,
      workspaceId,
    )
    if (!existing.ok) return existing
    if (!existing.value) return err(whatsappConversationNotFound())

    if (assignedUserId) {
      const targetMembership = await assertMember(assignedUserId, workspaceId)
      if (!targetMembership.ok) {
        return err(
          badRequest('Usuário informado não pertence a este workspace'),
        )
      }
    }

    const updated = await WhatsAppConversationRepository.update(id, {
      assignedUserId,
      status: 'IN_PROGRESS',
    })
    if (!updated.ok) return updated

    const fresh = await WhatsAppConversationRepository.findById(id, workspaceId)
    if (!fresh.ok) return fresh
    if (!fresh.value) return err(whatsappConversationNotFound())

    const dto = toWhatsAppConversationDTO(fresh.value)
    await publishWhatsAppEvent(workspaceId, {
      type: 'conversation.updated',
      conversation: dto,
    })

    auditMutation({
      entity: 'whatsapp_conversation',
      action: 'assign',
      actorId,
      targetId: id,
      meta: { assignedUserId },
    })

    return ok(dto)
  },
}
