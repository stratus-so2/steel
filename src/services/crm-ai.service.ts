import OpenAI from 'openai'
import { auditMutation } from '@/lib/axiom/audit'
import { OPENAI_API_KEY } from '@/lib/env/server'
import { crmAiNotConfigured } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  toCrmAiConversationDTO,
  toCrmAiMessageDTO,
} from '@/src/mappers/crm-ai.mapper'
import {
  CrmAiConversationRepository,
  CrmAiMessageRepository,
  CrmAiUsageRepository,
} from '@/src/repositories/crm-ai.repository'
import type { CreateCrmAiConversationDTO } from '@/src/schemas/crm-ai.schema'
import type { CrmAiConversationDTO, CrmAiMessageDTO } from '@/types/crm-ai'
import { assertMember } from './authz'

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

    return ok(result.value.map(toCrmAiMessageDTO))
  },

  async sendMessage(
    actorId: string,
    workspaceId: string,
    conversationId: string,
    content: string,
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
      content,
    })
    if (!userMessage.ok) return userMessage

    const history =
      await CrmAiMessageRepository.listByConversation(conversationId)
    if (!history.ok) return history

    const client = new OpenAI({ apiKey: OPENAI_API_KEY })
    const recent = history.value.slice(-HISTORY_LIMIT)

    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...recent.map((message) => ({
          role:
            message.role === 'USER'
              ? ('user' as const)
              : ('assistant' as const),
          content: message.content,
        })),
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
}
