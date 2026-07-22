import { auditMutation } from '@/lib/axiom/audit'
import {
  whatsappConnectionNotFound,
  whatsappConversationAiHandling,
  whatsappConversationNotFound,
  whatsappMessageNotFound,
} from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { publishWhatsAppEvent } from '@/src/lib/whatsapp/realtime'
import { WhatsAppSend } from '@/src/lib/whatsapp/send'
import { toWhatsAppConversationDTO } from '@/src/mappers/whatsapp-conversation.mapper'
import { toWhatsAppMessageDTO } from '@/src/mappers/whatsapp-message.mapper'
import { WhatsAppConnectionRepository } from '@/src/repositories/whatsapp-connection.repository'
import {
  WhatsAppConversationRepository,
  type WhatsAppConversationWithPreview,
} from '@/src/repositories/whatsapp-conversation.repository'
import { WhatsAppMessageRepository } from '@/src/repositories/whatsapp-message.repository'
import type {
  ListWhatsAppMessagesDTO,
  ReactToWhatsAppMessageDTO,
  SendWhatsAppMediaMessageDTO,
  SendWhatsAppTemplateMessageDTO,
  SendWhatsAppTextMessageDTO,
} from '@/src/schemas/whatsapp-message.schema'
import type {
  WhatsAppMessageDTO,
  WhatsAppMessageTypeDTO,
} from '@/types/whatsapp-message'
import { assertMember } from './authz'

async function loadSendableConversation(
  workspaceId: string,
  conversationId: string,
) {
  const conversation = await WhatsAppConversationRepository.findById(
    conversationId,
    workspaceId,
  )
  if (!conversation.ok) return conversation
  if (!conversation.value) return err(whatsappConversationNotFound())
  if (conversation.value.aiActive) return err(whatsappConversationAiHandling())

  const connection = await WhatsAppConnectionRepository.findById(
    conversation.value.connectionId,
    workspaceId,
  )
  if (!connection.ok) return connection
  if (!connection.value) return err(whatsappConnectionNotFound())

  return ok({
    conversation: conversation.value as WhatsAppConversationWithPreview,
    connection: connection.value,
  })
}

async function resolveQuotedProviderMessageId(
  replyToMessageId: string | undefined,
): Promise<string | undefined> {
  if (!replyToMessageId) return undefined
  const quoted = await WhatsAppMessageRepository.findById(replyToMessageId)
  return quoted.ok ? (quoted.value?.providerMessageId ?? undefined) : undefined
}

async function finalizeOutboundMessage(input: {
  workspaceId: string
  conversationId: string
  actorId: string
  type: WhatsAppMessageTypeDTO
  text?: string
  mediaUrl?: string
  providerMessageId: string
  replyToMessageId?: string
}): Promise<Result<WhatsAppMessageDTO>> {
  const message = await WhatsAppMessageRepository.create({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    direction: 'OUT',
    type: input.type,
    text: input.text,
    mediaUrl: input.mediaUrl,
    providerMessageId: input.providerMessageId,
    status: 'SENT',
    senderUserId: input.actorId,
    replyToMessageId: input.replyToMessageId,
  })
  if (!message.ok) return message

  await WhatsAppConversationRepository.update(input.conversationId, {
    lastMessageAt: new Date(),
    status: 'IN_PROGRESS',
  })

  const dto = toWhatsAppMessageDTO(message.value)
  await publishWhatsAppEvent(input.workspaceId, {
    type: 'message.created',
    conversationId: input.conversationId,
    message: dto,
  })

  const freshConversation = await WhatsAppConversationRepository.findById(
    input.conversationId,
    input.workspaceId,
  )
  if (freshConversation.ok && freshConversation.value) {
    await publishWhatsAppEvent(input.workspaceId, {
      type: 'conversation.updated',
      conversation: toWhatsAppConversationDTO(freshConversation.value),
    })
  }

  auditMutation({
    entity: 'whatsapp_message',
    action: 'send',
    actorId: input.actorId,
    targetId: message.value.id,
    meta: { conversationId: input.conversationId, type: input.type },
  })

  return ok(dto)
}

export const WhatsAppMessageService = {
  async list(
    actorId: string,
    workspaceId: string,
    conversationId: string,
    options: ListWhatsAppMessagesDTO,
  ): Promise<Result<WhatsAppMessageDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const conversation = await WhatsAppConversationRepository.findById(
      conversationId,
      workspaceId,
    )
    if (!conversation.ok) return conversation
    if (!conversation.value) return err(whatsappConversationNotFound())

    const result = await WhatsAppMessageRepository.listByConversation(
      conversationId,
      {
        cursor: options.cursor,
        limit: options.limit,
        after: conversation.value.clearedAt,
      },
    )
    if (!result.ok) return result

    return ok(result.value.map(toWhatsAppMessageDTO))
  },

  async sendText(
    actorId: string,
    workspaceId: string,
    conversationId: string,
    dto: SendWhatsAppTextMessageDTO,
  ): Promise<Result<WhatsAppMessageDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const loaded = await loadSendableConversation(workspaceId, conversationId)
    if (!loaded.ok) return loaded

    const quotedProviderMessageId = await resolveQuotedProviderMessageId(
      dto.replyToMessageId,
    )

    const sendResult = await WhatsAppSend.text(loaded.value.connection, {
      to: loaded.value.conversation.contact.waId,
      text: dto.text,
      quotedProviderMessageId,
    })
    if (!sendResult.ok) return sendResult

    return finalizeOutboundMessage({
      workspaceId,
      conversationId,
      actorId,
      type: 'TEXT',
      text: dto.text,
      providerMessageId: sendResult.value.providerMessageId,
      replyToMessageId: dto.replyToMessageId,
    })
  },

  async sendMedia(
    actorId: string,
    workspaceId: string,
    conversationId: string,
    dto: SendWhatsAppMediaMessageDTO,
  ): Promise<Result<WhatsAppMessageDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const loaded = await loadSendableConversation(workspaceId, conversationId)
    if (!loaded.ok) return loaded

    const mediaType = dto.type.toLowerCase() as
      | 'image'
      | 'audio'
      | 'video'
      | 'document'

    const quotedProviderMessageId = await resolveQuotedProviderMessageId(
      dto.replyToMessageId,
    )

    const sendResult = await WhatsAppSend.media(loaded.value.connection, {
      to: loaded.value.conversation.contact.waId,
      mediaUrl: dto.mediaUrl,
      type: mediaType,
      caption: dto.caption,
      fileName: dto.fileName,
      quotedProviderMessageId,
    })
    if (!sendResult.ok) return sendResult

    return finalizeOutboundMessage({
      workspaceId,
      conversationId,
      actorId,
      type: dto.type,
      text: dto.caption,
      mediaUrl: dto.mediaUrl,
      providerMessageId: sendResult.value.providerMessageId,
      replyToMessageId: dto.replyToMessageId,
    })
  },

  async sendTemplate(
    actorId: string,
    workspaceId: string,
    conversationId: string,
    dto: SendWhatsAppTemplateMessageDTO,
  ): Promise<Result<WhatsAppMessageDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const loaded = await loadSendableConversation(workspaceId, conversationId)
    if (!loaded.ok) return loaded

    const sendResult = await WhatsAppSend.template(loaded.value.connection, {
      to: loaded.value.conversation.contact.waId,
      templateName: dto.templateName,
      language: dto.language,
      components: dto.components,
    })
    if (!sendResult.ok) return sendResult

    return finalizeOutboundMessage({
      workspaceId,
      conversationId,
      actorId,
      type: 'TEMPLATE',
      text: dto.templateName,
      providerMessageId: sendResult.value.providerMessageId,
    })
  },

  async react(
    actorId: string,
    workspaceId: string,
    conversationId: string,
    messageId: string,
    dto: ReactToWhatsAppMessageDTO,
  ): Promise<Result<WhatsAppMessageDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const loaded = await loadSendableConversation(workspaceId, conversationId)
    if (!loaded.ok) return loaded

    const target = await WhatsAppMessageRepository.findById(messageId)
    if (!target.ok) return target
    if (!target.value || target.value.conversationId !== conversationId) {
      return err(whatsappMessageNotFound())
    }
    if (!target.value.providerMessageId) {
      return err(whatsappMessageNotFound())
    }

    const sendResult = await WhatsAppSend.reaction(loaded.value.connection, {
      to: loaded.value.conversation.contact.waId,
      providerMessageId: target.value.providerMessageId,
      emoji: dto.emoji,
    })
    if (!sendResult.ok) return sendResult

    const updated = await WhatsAppMessageRepository.update(messageId, {
      reactionEmoji: dto.emoji || null,
      reactedByContact: dto.emoji ? false : null,
    })
    if (!updated.ok) return updated

    const messageDto = toWhatsAppMessageDTO(updated.value)
    await publishWhatsAppEvent(workspaceId, {
      type: 'message.updated',
      conversationId,
      message: messageDto,
    })

    return ok(messageDto)
  },
}
