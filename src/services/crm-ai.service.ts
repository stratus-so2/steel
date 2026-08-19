import OpenAI from 'openai'
import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
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
import { CRM_AI_FUNCTION_TOOLS, executeAiTool } from './crm-ai-tools'

const MODEL = 'gpt-4o-mini'
/**
 * O agente tem tools de leitura (pipeline, leads, propostas, concorrentes,
 * posts em alta) e de escrita (criar lead/dashboard/formulário/template de
 * proposta) — cada `create_*` exige o campo `userConfirmed: true`, que o
 * modelo só deve marcar depois de o usuário aprovar explicitamente a
 * proposta numa mensagem anterior. Reforçamos isso aqui porque o schema
 * sozinho não garante — é o modelo seguindo a instrução.
 */
const SYSTEM_PROMPT = `Você é o assistente de CRM do Steel. Ajude o usuário com vendas, contatos, funil de oportunidades, propostas, concorrentes e desempenho de conteúdo social, de forma objetiva, em português do Brasil.

Você tem acesso a ferramentas que consultam dados reais do workspace (pipeline, leads, propostas, concorrentes, posts em alta) e busca na web. Use-as sempre que a pergunta depender de dado real — nunca invente números, nomes ou métricas.

Você também pode CRIAR registros reais (lead, dashboard, formulário, template de proposta). Regra obrigatória: antes de qualquer criação, descreva em texto exatamente o que vai criar (todos os campos relevantes) e pergunte se pode prosseguir. Só chame a função de criação — com \`userConfirmed: true\` — depois que o usuário confirmar explicitamente essa proposta específica numa mensagem sua mais recente. Nunca marque \`userConfirmed: true\` por conta própria.`
const HISTORY_LIMIT = 20
/** Teto de idas-e-voltas de tool-calling numa mesma mensagem — evita loop indefinido. */
const MAX_TOOL_ROUNDS = 6

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

    const input: OpenAI.Responses.ResponseInputItem[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...recent.map((message): OpenAI.Responses.ResponseInputItem => {
        if (
          message.role === 'USER' &&
          message.id === userMessage.value.id &&
          imageUrls.length > 0
        ) {
          return {
            role: 'user',
            content: [
              { type: 'input_text', text: message.content },
              ...imageUrls.map((url) => ({
                type: 'input_image' as const,
                image_url: url,
                detail: 'auto' as const,
              })),
            ],
          }
        }

        return {
          role: message.role === 'USER' ? 'user' : 'assistant',
          content: message.content,
        }
      }),
    ]

    let replyText = 'Não consegui gerar uma resposta agora.'
    let totalInputTokens = 0
    let totalOutputTokens = 0
    const toolCallLog: string[] = []

    // Loop de tool-calling: chama o modelo, executa as funções que ele pedir,
    // devolve o resultado, repete — até ele responder em texto final ou
    // estourar `MAX_TOOL_ROUNDS` (evita loop indefinido em caso de tool que
    // sempre "falha" de um jeito que o modelo insiste em tentar de novo).
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await client.responses.create({
        model: MODEL,
        input,
        tools: [{ type: 'web_search' }, ...CRM_AI_FUNCTION_TOOLS],
      })

      totalInputTokens += response.usage?.input_tokens ?? 0
      totalOutputTokens += response.usage?.output_tokens ?? 0

      const functionCalls = response.output.filter(
        (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
          item.type === 'function_call',
      )

      if (functionCalls.length === 0) {
        replyText = response.output_text || replyText
        break
      }

      input.push(...functionCalls)
      for (const call of functionCalls) {
        toolCallLog.push(call.name)
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(call.arguments)
        } catch {
          // Argumentos malformados do modelo — segue com objeto vazio; a
          // tool valida o payload e devolve erro legível pro modelo tentar de novo.
        }
        const output = await executeAiTool(call.name, args, {
          actorId,
          workspaceId,
        })
        input.push({
          type: 'function_call_output',
          call_id: call.call_id,
          output,
        })
      }

      if (round === MAX_TOOL_ROUNDS - 1) {
        replyText =
          'Não consegui concluir isso agora — precisou de mais etapas do que o permitido. Tente reformular a pergunta em partes menores.'
      }
    }

    if (toolCallLog.length > 0) {
      logger.info('crm_ai.tool_calls', {
        component: 'CrmAiConversationService',
        conversationId,
        workspaceId,
        tools: toolCallLog,
      })
    }

    const assistantMessage = await CrmAiMessageRepository.create({
      conversationId,
      role: 'ASSISTANT',
      content: replyText,
    })
    if (!assistantMessage.ok) return assistantMessage

    await CrmAiUsageRepository.record({
      workspaceId,
      conversationId,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
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
    const stored = await storeAttachment(
      conversationId,
      body,
      input.contentType,
      ext,
    )
    if (!stored.ok) return stored
    const storageKey = stored.value

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
