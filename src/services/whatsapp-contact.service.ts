import { auditMutation } from '@/lib/axiom/audit'
import { whatsappContactNotFound } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { toWhatsAppContactDTO } from '@/src/mappers/whatsapp-contact.mapper'
import { WhatsAppContactRepository } from '@/src/repositories/whatsapp-contact.repository'
import type {
  CreateWhatsAppContactDTO,
  ListWhatsAppContactsDTO,
  UpdateWhatsAppContactDTO,
} from '@/src/schemas/whatsapp-contact.schema'
import type { WhatsAppContactDTO } from '@/types/whatsapp-contact'
import { assertMember } from './authz'

export const WhatsAppContactService = {
  async list(
    actorId: string,
    workspaceId: string,
    options: ListWhatsAppContactsDTO,
  ): Promise<Result<WhatsAppContactDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await WhatsAppContactRepository.listByWorkspace(
      workspaceId,
      options.search,
    )
    if (!result.ok) return result

    return ok(result.value.map(toWhatsAppContactDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateWhatsAppContactDTO,
  ): Promise<Result<WhatsAppContactDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await WhatsAppContactRepository.create({
      workspaceId,
      waId: dto.waId,
      name: dto.name,
      avatarUrl: dto.avatarUrl,
    })
    if (!result.ok) {
      auditMutation({
        entity: 'whatsapp_contact',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'whatsapp_contact',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toWhatsAppContactDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    id: string,
    dto: UpdateWhatsAppContactDTO,
  ): Promise<Result<WhatsAppContactDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await WhatsAppContactRepository.findById(id, workspaceId)
    if (!existing.ok) return existing
    if (!existing.value) return err(whatsappContactNotFound())

    const result = await WhatsAppContactRepository.update(id, dto)
    if (!result.ok) return result

    auditMutation({
      entity: 'whatsapp_contact',
      action: 'update',
      actorId,
      targetId: id,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toWhatsAppContactDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    id: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await WhatsAppContactRepository.findById(id, workspaceId)
    if (!existing.ok) return existing
    if (!existing.value) return err(whatsappContactNotFound())

    const result = await WhatsAppContactRepository.delete(id)
    if (!result.ok) return result

    auditMutation({
      entity: 'whatsapp_contact',
      action: 'delete',
      actorId,
      targetId: id,
    })

    return ok(undefined)
  },
}
