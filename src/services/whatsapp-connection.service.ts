import { auditMutation } from '@/lib/axiom/audit'
import { badRequest, whatsappConnectionNotFound } from '@/src/errors'
import {
  decryptConnectionSecret,
  encryptConnectionSecret,
} from '@/src/lib/crypto'
import { err, ok, type Result } from '@/src/lib/result'
import { createZapiClient } from '@/src/lib/whatsapp/zapi-client'
import {
  toWhatsAppConnectionCreatedDTO,
  toWhatsAppConnectionDTO,
} from '@/src/mappers/whatsapp-connection.mapper'
import { WhatsAppConnectionRepository } from '@/src/repositories/whatsapp-connection.repository'
import type {
  CreateWhatsAppConnectionDTO,
  UpdateWhatsAppConnectionDTO,
} from '@/src/schemas/whatsapp-connection.schema'
import type {
  WhatsAppConnectionCreatedDTO,
  WhatsAppConnectionDTO,
} from '@/types/whatsapp-connection'
import { assertMember, assertPrivileged } from './authz'

export const WhatsAppConnectionService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<WhatsAppConnectionDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result =
      await WhatsAppConnectionRepository.listByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(result.value.map(toWhatsAppConnectionDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateWhatsAppConnectionDTO,
  ): Promise<Result<WhatsAppConnectionCreatedDTO>> {
    const privileged = await assertPrivileged(actorId, workspaceId)
    if (!privileged.ok) {
      auditMutation({
        entity: 'whatsapp_connection',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: privileged.error.code,
      })
      return privileged
    }

    const baseData = {
      workspaceId,
      provider: dto.provider,
      label: dto.label,
      phoneNumber: dto.phoneNumber,
      createdById: actorId,
    }

    const data =
      dto.provider === 'ZAPI'
        ? {
            ...baseData,
            zapiInstanceId: dto.zapiInstanceId,
            encryptedZapiToken: await encryptConnectionSecret(dto.zapiToken),
            encryptedZapiClientToken: dto.zapiClientToken
              ? await encryptConnectionSecret(dto.zapiClientToken)
              : null,
          }
        : {
            ...baseData,
            metaPhoneNumberId: dto.metaPhoneNumberId,
            metaWabaId: dto.metaWabaId,
            encryptedMetaAccessToken: await encryptConnectionSecret(
              dto.metaAccessToken,
            ),
          }

    const result = await WhatsAppConnectionRepository.create(data)
    if (!result.ok) {
      auditMutation({
        entity: 'whatsapp_connection',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'whatsapp_connection',
      action: 'create',
      actorId,
      targetId: result.value.id,
      meta: { provider: dto.provider },
    })

    return ok(toWhatsAppConnectionCreatedDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    id: string,
    dto: UpdateWhatsAppConnectionDTO,
  ): Promise<Result<WhatsAppConnectionDTO>> {
    const privileged = await assertPrivileged(actorId, workspaceId)
    if (!privileged.ok) return privileged

    const existing = await WhatsAppConnectionRepository.findById(
      id,
      workspaceId,
    )
    if (!existing.ok) return existing
    if (!existing.value) return err(whatsappConnectionNotFound())

    const data: Record<string, unknown> = {}
    if (dto.label !== undefined) data.label = dto.label
    if (dto.zapiToken !== undefined) {
      data.encryptedZapiToken = await encryptConnectionSecret(dto.zapiToken)
    }
    if (dto.zapiClientToken !== undefined) {
      data.encryptedZapiClientToken = await encryptConnectionSecret(
        dto.zapiClientToken,
      )
    }
    if (dto.metaAccessToken !== undefined) {
      data.encryptedMetaAccessToken = await encryptConnectionSecret(
        dto.metaAccessToken,
      )
    }

    const result = await WhatsAppConnectionRepository.update(id, data)
    if (!result.ok) {
      auditMutation({
        entity: 'whatsapp_connection',
        action: 'update',
        actorId,
        targetId: id,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'whatsapp_connection',
      action: 'update',
      actorId,
      targetId: id,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toWhatsAppConnectionDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    id: string,
  ): Promise<Result<void>> {
    const privileged = await assertPrivileged(actorId, workspaceId)
    if (!privileged.ok) return privileged

    const existing = await WhatsAppConnectionRepository.findById(
      id,
      workspaceId,
    )
    if (!existing.ok) return existing
    if (!existing.value) return err(whatsappConnectionNotFound())

    const result = await WhatsAppConnectionRepository.delete(id)
    if (!result.ok) return result

    auditMutation({
      entity: 'whatsapp_connection',
      action: 'delete',
      actorId,
      targetId: id,
    })

    return ok(undefined)
  },

  async getQrCode(
    actorId: string,
    workspaceId: string,
    id: string,
  ): Promise<Result<{ status: string; qrCodeBase64?: string }>> {
    const privileged = await assertPrivileged(actorId, workspaceId)
    if (!privileged.ok) return privileged

    const existing = await WhatsAppConnectionRepository.findById(
      id,
      workspaceId,
    )
    if (!existing.ok) return existing
    if (!existing.value) return err(whatsappConnectionNotFound())

    const connection = existing.value
    if (connection.provider !== 'ZAPI') {
      return err(
        badRequest('QR code está disponível apenas para conexões Z-API'),
      )
    }
    if (!connection.zapiInstanceId || !connection.encryptedZapiToken) {
      return err(badRequest('Conexão Z-API sem credenciais configuradas'))
    }

    const token = await decryptConnectionSecret(connection.encryptedZapiToken)
    const clientToken = connection.encryptedZapiClientToken
      ? await decryptConnectionSecret(connection.encryptedZapiClientToken)
      : undefined

    const client = createZapiClient({
      instanceId: connection.zapiInstanceId,
      token,
      clientToken,
    })

    const qr = await client.getQrCode()

    const newStatus = qr.status === 'connected' ? 'CONNECTED' : 'CONNECTING'
    if (newStatus !== connection.status) {
      await WhatsAppConnectionRepository.update(id, { status: newStatus })
    }

    return ok(qr)
  },
}
