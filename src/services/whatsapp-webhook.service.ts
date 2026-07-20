import type { WhatsAppConnection, WhatsAppMessageStatus } from '@prisma/client'
import { WhatsappAiReplyJob, WhatsappMediaJob } from '@/src/lib/queue/jobs'
import {
  getWhatsappAiReplyQueue,
  getWhatsappMediaQueue,
} from '@/src/lib/queue/queues'
import { ok, type Result } from '@/src/lib/result'
import { publishWhatsAppEvent } from '@/src/lib/whatsapp/realtime'
import { toWhatsAppConversationDTO } from '@/src/mappers/whatsapp-conversation.mapper'
import { toWhatsAppMessageDTO } from '@/src/mappers/whatsapp-message.mapper'
import { WhatsAppAiConfigRepository } from '@/src/repositories/whatsapp-ai-config.repository'
import { WhatsAppContactRepository } from '@/src/repositories/whatsapp-contact.repository'
import { WhatsAppConversationRepository } from '@/src/repositories/whatsapp-conversation.repository'
import { WhatsAppMessageRepository } from '@/src/repositories/whatsapp-message.repository'
import type { WhatsAppMessageTypeDTO } from '@/types/whatsapp-message'

export interface InboundWhatsAppMessage {
  connection: WhatsAppConnection
  waId: string
  contactName?: string
  providerMessageId: string
  type: WhatsAppMessageTypeDTO
  text?: string
  rawMediaUrl?: string
}

async function publishConversationSnapshot(
  workspaceId: string,
  conversationId: string,
): Promise<void> {
  const fresh = await WhatsAppConversationRepository.findById(
    conversationId,
    workspaceId,
  )
  if (!fresh.ok || !fresh.value) return

  await publishWhatsAppEvent(workspaceId, {
    type: 'conversation.updated',
    conversation: toWhatsAppConversationDTO(fresh.value),
  })
}

export const WhatsAppWebhookService = {
  async ingestInboundMessage(
    input: InboundWhatsAppMessage,
  ): Promise<Result<void>> {
    const { connection } = input
    const workspaceId = connection.workspaceId

    const dedupe = await WhatsAppMessageRepository.findByProviderMessageId(
      input.providerMessageId,
    )
    if (!dedupe.ok) return dedupe
    if (dedupe.value) return ok(undefined)

    const contact = await WhatsAppContactRepository.upsertByWaId({
      workspaceId,
      waId: input.waId,
      name: input.contactName,
    })
    if (!contact.ok) return contact

    const aiConfig =
      await WhatsAppAiConfigRepository.findByWorkspace(workspaceId)
    if (!aiConfig.ok) return aiConfig
    const aiConfigActive = aiConfig.value?.active ?? false

    const existingConversation =
      await WhatsAppConversationRepository.findActiveByContact(
        workspaceId,
        contact.value.id,
      )
    if (!existingConversation.ok) return existingConversation

    let conversationId: string
    let aiActive: boolean

    if (existingConversation.value) {
      const conversation = existingConversation.value
      aiActive = conversation.aiActive
      if (!conversation.aiActive && !conversation.aiHandoff && aiConfigActive) {
        aiActive = true
      }

      const updated = await WhatsAppConversationRepository.update(
        conversation.id,
        {
          unreadCount: { increment: 1 },
          lastMessageAt: new Date(),
          aiActive,
        },
      )
      if (!updated.ok) return updated
      conversationId = updated.value.id
    } else {
      const created = await WhatsAppConversationRepository.create({
        workspaceId,
        connectionId: connection.id,
        contactId: contact.value.id,
        status: 'NEW',
        aiActive: aiConfigActive,
        aiHandoff: false,
        unreadCount: 1,
        lastMessageAt: new Date(),
      })
      if (!created.ok) return created
      conversationId = created.value.id
      aiActive = aiConfigActive
    }

    const message = await WhatsAppMessageRepository.create({
      workspaceId,
      conversationId,
      direction: 'IN',
      type: input.type,
      text: input.text,
      mediaUrl: input.rawMediaUrl,
      providerMessageId: input.providerMessageId,
      status: 'DELIVERED',
    })
    if (!message.ok) return message

    if (input.rawMediaUrl) {
      await getWhatsappMediaQueue().add(WhatsappMediaJob.DownloadInboundMedia, {
        messageId: message.value.id,
      })
    }

    await publishWhatsAppEvent(workspaceId, {
      type: 'message.created',
      conversationId,
      message: toWhatsAppMessageDTO(message.value),
    })
    await publishConversationSnapshot(workspaceId, conversationId)

    if (aiActive) {
      await getWhatsappAiReplyQueue().add(WhatsappAiReplyJob.GenerateAiReply, {
        conversationId,
        messageId: message.value.id,
      })
    }

    return ok(undefined)
  },

  // A message the agent sent directly from the linked phone (outside the
  // platform) — Z-API reports these with fromMe=true. Persisted as an
  // outbound message so it shows up in the conversation, and hands off from
  // AI (a human already replied), unlike a genuine inbound message.
  async ingestOutboundDeviceMessage(
    input: InboundWhatsAppMessage,
  ): Promise<Result<void>> {
    const { connection } = input
    const workspaceId = connection.workspaceId

    const dedupe = await WhatsAppMessageRepository.findByProviderMessageId(
      input.providerMessageId,
    )
    if (!dedupe.ok) return dedupe
    if (dedupe.value) return ok(undefined)

    const contact = await WhatsAppContactRepository.upsertByWaId({
      workspaceId,
      waId: input.waId,
      name: input.contactName,
    })
    if (!contact.ok) return contact

    const existingConversation =
      await WhatsAppConversationRepository.findActiveByContact(
        workspaceId,
        contact.value.id,
      )
    if (!existingConversation.ok) return existingConversation

    let conversationId: string

    if (existingConversation.value) {
      const conversation = existingConversation.value
      const updated = await WhatsAppConversationRepository.update(
        conversation.id,
        {
          lastMessageAt: new Date(),
          aiActive: false,
          aiHandoff: true,
        },
      )
      if (!updated.ok) return updated
      conversationId = updated.value.id
    } else {
      const created = await WhatsAppConversationRepository.create({
        workspaceId,
        connectionId: connection.id,
        contactId: contact.value.id,
        status: 'IN_PROGRESS',
        aiActive: false,
        aiHandoff: true,
        unreadCount: 0,
        lastMessageAt: new Date(),
      })
      if (!created.ok) return created
      conversationId = created.value.id
    }

    const message = await WhatsAppMessageRepository.create({
      workspaceId,
      conversationId,
      direction: 'OUT',
      type: input.type,
      text: input.text,
      mediaUrl: input.rawMediaUrl,
      providerMessageId: input.providerMessageId,
      status: 'SENT',
    })
    if (!message.ok) return message

    if (input.rawMediaUrl) {
      await getWhatsappMediaQueue().add(WhatsappMediaJob.DownloadInboundMedia, {
        messageId: message.value.id,
      })
    }

    await publishWhatsAppEvent(workspaceId, {
      type: 'message.created',
      conversationId,
      message: toWhatsAppMessageDTO(message.value),
    })
    await publishConversationSnapshot(workspaceId, conversationId)

    return ok(undefined)
  },

  async ingestStatusUpdate(input: {
    providerMessageId: string
    status: WhatsAppMessageStatus
  }): Promise<Result<void>> {
    const result =
      await WhatsAppMessageRepository.updateStatusByProviderMessageId(
        input.providerMessageId,
        input.status,
      )
    if (!result.ok) return result
    if (!result.value) return ok(undefined)

    await publishWhatsAppEvent(result.value.workspaceId, {
      type: 'message.updated',
      conversationId: result.value.conversationId,
      message: toWhatsAppMessageDTO(result.value),
    })

    return ok(undefined)
  },
}
