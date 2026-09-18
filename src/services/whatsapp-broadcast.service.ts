import { auditMutation } from '@/lib/axiom/audit'
import {
  whatsappBroadcastLocked,
  whatsappBroadcastNoRecipients,
  whatsappBroadcastNotFound,
  whatsappConnectionNotFound,
} from '@/src/errors'
import { WhatsappBroadcastJob } from '@/src/lib/queue/jobs'
import { getWhatsappBroadcastQueue } from '@/src/lib/queue/queues'
import { err, ok, type Result } from '@/src/lib/result'
import {
  toWhatsAppBroadcastListDetailDTO,
  toWhatsAppBroadcastListDTO,
} from '@/src/mappers/whatsapp-broadcast.mapper'
import { WhatsAppBroadcastRepository } from '@/src/repositories/whatsapp-broadcast.repository'
import { WhatsAppConnectionRepository } from '@/src/repositories/whatsapp-connection.repository'
import { WhatsAppContactRepository } from '@/src/repositories/whatsapp-contact.repository'
import type { CreateWhatsAppBroadcastDTO } from '@/src/schemas/whatsapp-broadcast.schema'
import type {
  WhatsAppBroadcastListDetailDTO,
  WhatsAppBroadcastListDTO,
} from '@/types/whatsapp-broadcast'
import { assertModuleMember } from './authz'

const STAGGER_DELAY_MS = 4000

export const WhatsAppBroadcastService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<WhatsAppBroadcastListDTO[]>> {
    const membership = await assertModuleMember(
      actorId,
      workspaceId,
      'COMMUNICATION',
      { resource: 'broadcasts', action: 'VIEW' },
    )
    if (!membership.ok) return membership

    const result =
      await WhatsAppBroadcastRepository.listByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(result.value.map(toWhatsAppBroadcastListDTO))
  },

  async get(
    actorId: string,
    workspaceId: string,
    id: string,
  ): Promise<Result<WhatsAppBroadcastListDetailDTO>> {
    const membership = await assertModuleMember(
      actorId,
      workspaceId,
      'COMMUNICATION',
      { resource: 'broadcasts', action: 'VIEW' },
    )
    if (!membership.ok) return membership

    const result = await WhatsAppBroadcastRepository.findById(id, workspaceId)
    if (!result.ok) return result
    if (!result.value) return err(whatsappBroadcastNotFound())

    return ok(toWhatsAppBroadcastListDetailDTO(result.value))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateWhatsAppBroadcastDTO,
  ): Promise<Result<WhatsAppBroadcastListDetailDTO>> {
    const membership = await assertModuleMember(
      actorId,
      workspaceId,
      'COMMUNICATION',
      { resource: 'broadcasts', action: 'CREATE' },
    )
    if (!membership.ok) return membership

    const connection = await WhatsAppConnectionRepository.findById(
      dto.connectionId,
      workspaceId,
    )
    if (!connection.ok) return connection
    if (!connection.value) return err(whatsappConnectionNotFound())

    const requestedIds = Array.from(new Set(dto.contactIds))
    // Opt-out LGPD: descadastrados (e contatos de outro workspace) saem na
    // própria query — a UI só reflete, não é a barreira.
    const eligible = await WhatsAppContactRepository.listBroadcastEligibleIds(
      workspaceId,
      requestedIds,
    )
    if (!eligible.ok) return eligible
    const uniqueContactIds = eligible.value
    if (uniqueContactIds.length === 0) {
      return err(whatsappBroadcastNoRecipients())
    }

    const result = await WhatsAppBroadcastRepository.create(
      {
        workspaceId,
        connectionId: dto.connectionId,
        name: dto.name,
        messageBody: dto.messageBody,
        mediaUrl: dto.mediaUrl,
        createdById: actorId,
      },
      uniqueContactIds,
    )
    if (!result.ok) return result

    auditMutation({
      entity: 'whatsapp_broadcast_list',
      action: 'create',
      actorId,
      targetId: result.value.id,
      meta: {
        recipients: uniqueContactIds.length,
        excluded: requestedIds.length - uniqueContactIds.length,
      },
    })

    return ok(toWhatsAppBroadcastListDetailDTO(result.value))
  },

  async start(
    actorId: string,
    workspaceId: string,
    id: string,
  ): Promise<Result<WhatsAppBroadcastListDetailDTO>> {
    const membership = await assertModuleMember(
      actorId,
      workspaceId,
      'COMMUNICATION',
      { resource: 'broadcasts', action: 'CREATE' },
    )
    if (!membership.ok) return membership

    const existing = await WhatsAppBroadcastRepository.findById(id, workspaceId)
    if (!existing.ok) return existing
    if (!existing.value) return err(whatsappBroadcastNotFound())
    if (existing.value.status !== 'DRAFT') return err(whatsappBroadcastLocked())

    // Quem se descadastrou entre a criação da lista e o disparo não recebe.
    const optedOut = existing.value.recipients.filter(
      (recipient) => recipient.contact.broadcastOptedOutAt !== null,
    )
    const sendable = existing.value.recipients.filter(
      (recipient) => recipient.contact.broadcastOptedOutAt === null,
    )
    if (optedOut.length > 0) {
      const skipped = await WhatsAppBroadcastRepository.markRecipientsSkipped(
        optedOut.map((recipient) => recipient.id),
      )
      if (!skipped.ok) return skipped
    }

    const queue = getWhatsappBroadcastQueue()
    await queue.addBulk(
      sendable.map((recipient, index) => ({
        name: WhatsappBroadcastJob.SendBroadcastMessage,
        data: { broadcastListId: id, recipientId: recipient.id },
        opts: { delay: index * STAGGER_DELAY_MS },
      })),
    )

    const updated = await WhatsAppBroadcastRepository.updateStatus(
      id,
      sendable.length > 0 ? 'RUNNING' : 'DONE',
    )
    if (!updated.ok) return updated

    auditMutation({
      entity: 'whatsapp_broadcast_list',
      action: 'start',
      actorId,
      targetId: id,
      meta: { recipients: sendable.length, skipped: optedOut.length },
    })

    const fresh = await WhatsAppBroadcastRepository.findById(id, workspaceId)
    if (!fresh.ok) return fresh
    if (!fresh.value) return err(whatsappBroadcastNotFound())

    return ok(toWhatsAppBroadcastListDetailDTO(fresh.value))
  },
}
