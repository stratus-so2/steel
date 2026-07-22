import { auditMutation } from '@/lib/axiom/audit'
import {
  whatsappContactNotFound,
  whatsappContactPhotoUnavailable,
  whatsappProviderError,
} from '@/src/errors'
import { decryptConnectionSecret } from '@/src/lib/crypto'
import { err, ok, type Result } from '@/src/lib/result'
import { getZapiContactProfilePicture } from '@/src/lib/whatsapp/zapi-client'
import { toWhatsAppContactDTO } from '@/src/mappers/whatsapp-contact.mapper'
import { WhatsAppConnectionRepository } from '@/src/repositories/whatsapp-connection.repository'
import { WhatsAppContactRepository } from '@/src/repositories/whatsapp-contact.repository'
import type {
  CreateWhatsAppContactDTO,
  FindOrCreateWhatsAppContactDTO,
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
      description: dto.description,
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

  async findOrCreate(
    actorId: string,
    workspaceId: string,
    dto: FindOrCreateWhatsAppContactDTO,
  ): Promise<Result<WhatsAppContactDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await WhatsAppContactRepository.upsertByWaId({
      workspaceId,
      waId: dto.waId,
      name: dto.name,
    })
    if (!result.ok) return result

    return ok(toWhatsAppContactDTO(result.value))
  },

  async syncAvatar(
    actorId: string,
    workspaceId: string,
    id: string,
  ): Promise<Result<WhatsAppContactDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await WhatsAppContactRepository.findById(id, workspaceId)
    if (!existing.ok) return existing
    if (!existing.value) return err(whatsappContactNotFound())

    const connections =
      await WhatsAppConnectionRepository.listByWorkspace(workspaceId)
    if (!connections.ok) return connections
    const zapiConnection = connections.value.find(
      (connection) =>
        connection.provider === 'ZAPI' &&
        connection.zapiInstanceId &&
        connection.encryptedZapiToken,
    )
    if (!zapiConnection) {
      return err(
        whatsappContactPhotoUnavailable(
          'Buscar foto de perfil exige uma conexão Z-API — a API oficial da Meta não expõe fotos de contato',
        ),
      )
    }

    let avatarUrl: string | null
    try {
      const token = await decryptConnectionSecret(
        zapiConnection.encryptedZapiToken as string,
      )
      const clientToken = zapiConnection.encryptedZapiClientToken
        ? await decryptConnectionSecret(zapiConnection.encryptedZapiClientToken)
        : undefined
      avatarUrl = await getZapiContactProfilePicture(
        {
          instanceId: zapiConnection.zapiInstanceId as string,
          token,
          clientToken,
        },
        existing.value.waId,
      )
    } catch (error) {
      return err(
        whatsappProviderError(
          error instanceof Error ? error.message : 'Falha ao buscar foto',
        ),
      )
    }

    if (!avatarUrl) {
      return err(
        whatsappContactPhotoUnavailable(
          'Este contato não tem foto de perfil disponível no WhatsApp',
        ),
      )
    }

    const result = await WhatsAppContactRepository.update(id, { avatarUrl })
    if (!result.ok) return result

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
