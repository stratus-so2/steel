import OpenAI from 'openai'
import { auditMutation } from '@/lib/axiom/audit'
import { OPENAI_API_KEY } from '@/lib/env/server'
import { crmAiNotConfigured } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  toCrmAiAttachmentDTO,
  toCrmAiConversationDTO,
  toCrmAiMessageDTO,
} from '@/src/mappers/crm-ai.mapper'
import {
  CrmAiAttachmentRepository,
  CrmAiConversationRepository,
  CrmAiMessageRepository,
  CrmAiUsageRepository,
} from '@/src/repositories/crm-ai.repository'
import type {
  CreateCrmAiConversationDTO,
  SendCrmAiMessageDTO,
} from '@/src/schemas/crm-ai.schema'
import type {
  CrmAiAttachmentDTO,
  CrmAiConversationDTO,
  CrmAiMessageDTO,
} from '@/types/crm-ai'
import { assertMember } from './authz'
import {
  classifyAttachment,
  getAttachmentDownloadUrl,
  storeAttachment,
} from './crm-ai-attachment'

const MODEL = 'gpt-4o-mini'
const SYSTEM_PROMPT =
  'Você é o assistente de CRM do Steel. Ajude o usuário com dúvidas sobre vendas, contatos e o funil de oportunidades de forma objetiva, em português do Brasil.'
const HISTORY_LIMIT = 20

export const CrmAiConversationService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<CrmAiConversationDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmAiConversationRepository.listByUser(
      workspaceId,
      actorId,
    )
    if (!result.ok) return result

    return ok(result.value.map(toCrmAiConversationDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmAiConversationDTO,
  ): Promise<Result<CrmAiConversationDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmAiConversationRepository.create({
      workspaceId,
      userId: actorId,
      title: dto.title,
    })
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_ai_conversation',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toCrmAiConversationDTO(result.value))
  },

  async listMessages(
    actorId: string,
    workspaceId: string,
    conversationId: string,
  ): Promise<Result<CrmAiMessageDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const conversation = await CrmAiConversationRepository.findById(
      conversationId,
      workspaceId,
      actorId,
    )
    if (!conversation.ok) return conversation

    const result =
      await CrmAiMessageRepository.listByConversation(conversationId)
    if (!result.ok) return result

    const messages = await Promise.all(
      result.value.map(async (message) => {
        const attachments = await CrmAiAttachmentRepository.listByMessage(
          message.id,
        )
        if (!attachments.ok || attachments.value.length === 0) {
          return toCrmAiMessageDTO(message)
        }
        const withUrls = await Promise.all(
          attachments.value.map(async (attachment) =>
            toCrmAiAttachmentDTO(
              attachment,
              await getAttachmentDownloadUrl(attachment.storageKey),
            ),
          ),
        )
        return toCrmAiMessageDTO(message, withUrls)
      }),
    )

    return ok(messages)
  },

  async sendMessage(
    actorId: string,
    workspaceId: string,
    conversationId: string,
    dto: SendCrmAiMessageDTO,
  ): Promise<Result<CrmAiMessageDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const conversation = await CrmAiConversationRepository.findById(
      conversationId,
      workspaceId,
      actorId,
    )
    if (!conversation.ok) return conversation

    if (!OPENAI_API_KEY) return err(crmAiNotConfigured())

    const userMessage = await CrmAiMessageRepository.create({
      conversationId,
      role: 'USER',
      content: dto.content,
    })
    if (!userMessage.ok) return userMessage

    let imageUrls: string[] = []
    if (dto.attachmentIds && dto.attachmentIds.length > 0) {
      const pending = await CrmAiAttachmentRepository.findPendingByIds(
        dto.attachmentIds,
        conversationId,
      )
      if (!pending.ok) return pending

      await CrmAiAttachmentRepository.attachToMessage(
        pending.value.map((a) => a.id),
        userMessage.value.id,
      )

      const images = pending.value.filter((a) => a.kind === 'IMAGE')
      imageUrls = await Promise.all(
        images.map((a) => getAttachmentDownloadUrl(a.storageKey)),
      )
    }

    const history =
      await CrmAiMessageRepository.listByConversation(conversationId)
    if (!history.ok) return history

    const client = new OpenAI({ apiKey: OPENAI_API_KEY })
    const recent = history.value.slice(-HISTORY_LIMIT)

    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...recent.map((message): OpenAI.Chat.ChatCompletionMessageParam => {
          if (
            message.role === 'USER' &&
            message.id === userMessage.value.id &&
            imageUrls.length > 0
          ) {
            return {
              role: 'user',
              content: [
                { type: 'text', text: message.content },
                ...imageUrls.map((url) => ({
                  type: 'image_url' as const,
                  image_url: { url },
                })),
              ],
            }
          }

          return {
            role: message.role === 'USER' ? 'user' : 'assistant',
            content: message.content,
          }
        }),
      ],
    })

    const replyText =
      completion.choices[0]?.message?.content ??
      'Não consegui gerar uma resposta agora.'

    const assistantMessage = await CrmAiMessageRepository.create({
      conversationId,
      role: 'ASSISTANT',
      content: replyText,
    })
    if (!assistantMessage.ok) return assistantMessage

    await CrmAiUsageRepository.record({
      workspaceId,
      conversationId,
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
      model: MODEL,
    })

    await CrmAiConversationRepository.touch(conversationId)

    return ok(toCrmAiMessageDTO(assistantMessage.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    conversationId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const conversation = await CrmAiConversationRepository.findById(
      conversationId,
      workspaceId,
      actorId,
    )
    if (!conversation.ok) return conversation

    const result = await CrmAiConversationRepository.softDelete(conversationId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_ai_conversation',
      action: 'delete',
      actorId,
      targetId: conversationId,
    })

    return ok(undefined)
  },

  async uploadAttachment(
    actorId: string,
    workspaceId: string,
    conversationId: string,
    input: {
      contentType: string
      byteSize: number
      filename: string
      readBody: () => Promise<Buffer>
    },
  ): Promise<Result<CrmAiAttachmentDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const conversation = await CrmAiConversationRepository.findById(
      conversationId,
      workspaceId,
      actorId,
    )
    if (!conversation.ok) return conversation

    const classification = classifyAttachment(input.contentType, input.byteSize)
    if (!classification.ok) return classification
    const { kind, ext } = classification.value

    const body = await input.readBody()
    const storageKey = await storeAttachment(
      conversationId,
      body,
      input.contentType,
      ext,
    )

    const attachment = await CrmAiAttachmentRepository.create({
      conversationId,
      kind,
      filename: input.filename,
      contentType: input.contentType,
      sizeBytes: input.byteSize,
      storageKey,
    })
    if (!attachment.ok) return attachment

    auditMutation({
      entity: 'crm_ai_attachment',
      action: 'create',
      actorId,
      targetId: attachment.value.id,
      meta: { kind, conversationId },
    })

    return ok(
      toCrmAiAttachmentDTO(
        attachment.value,
        await getAttachmentDownloadUrl(storageKey),
      ),
    )
  },
}
