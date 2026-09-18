import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import { aiProviderUnavailable } from '@/src/errors'
import type { AiMessage } from '@/src/lib/ai/types'
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
import { AiUsageService } from './ai-usage.service'
import { assertModuleMember } from './authz'
import {
  classifyAttachment,
  getAttachmentDownloadUrl,
  storeAttachment,
} from './crm-ai-attachment'
import { CRM_AI_TOOLS, executeAiTool } from './crm-ai-tools'
import { assertFeature } from './feature-flag.service'

const REFUSAL_REPLY =
  'Não posso ajudar com esse pedido. Tente reformular a pergunta.'
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
    const membership = await assertModuleMember(actorId, workspaceId, 'CRM')
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
    const membership = await assertModuleMember(actorId, workspaceId, 'CRM')
    if (!membership.ok) return membership
    const feature = await assertFeature(workspaceId, 'crm.aiAssistant')
    if (!feature.ok) return feature

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
    const membership = await assertModuleMember(actorId, workspaceId, 'CRM')
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
    const membership = await assertModuleMember(actorId, workspaceId, 'CRM')
    if (!membership.ok) return membership
    const feature = await assertFeature(workspaceId, 'crm.aiAssistant')
    if (!feature.ok) return feature

    const conversation = await CrmAiConversationRepository.findById(
      conversationId,
      workspaceId,
      actorId,
    )
    if (!conversation.ok) return conversation

    // Resolve provedor/modelo (preferência do usuário → padrão do workspace)
    // e aplica a cota mensal antes de gravar qualquer coisa.
    const prepared = await AiUsageService.prepare(
      workspaceId,
      'CRM_ASSISTANT',
      actorId,
    )
    if (!prepared.ok) return prepared
    const call = prepared.value

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

    const recent = history.value.slice(-HISTORY_LIMIT)

    const messages: AiMessage[] = recent.map((message): AiMessage => {
      if (
        message.role === 'USER' &&
        message.id === userMessage.value.id &&
        imageUrls.length > 0
      ) {
        return {
          role: 'user',
          content: [
            { type: 'text', text: message.content },
            ...imageUrls.map((url) => ({ type: 'image' as const, url })),
          ],
        }
      }
      return message.role === 'USER'
        ? { role: 'user', content: message.content }
        : { role: 'assistant', content: message.content }
    })

    let replyText = 'Não consegui gerar uma resposta agora.'
    const usage = { inputTokens: 0, outputTokens: 0 }
    const toolCallLog: string[] = []

    // Loop de tool-calling: chama o modelo, executa as funções que ele pedir,
    // devolve o resultado, repete — até ele responder em texto final ou
    // estourar `MAX_TOOL_ROUNDS` (evita loop indefinido em caso de tool que
    // sempre "falha" de um jeito que o modelo insiste em tentar de novo).
    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const response = await call.provider.chat({
          model: call.model.model,
          system: SYSTEM_PROMPT,
          messages,
          tools: CRM_AI_TOOLS,
          webSearch: true,
        })

        usage.inputTokens += response.usage.inputTokens
        usage.outputTokens += response.usage.outputTokens

        if (response.stopReason !== 'tool_use') {
          replyText =
            response.text ||
            (response.stopReason === 'refusal' ? REFUSAL_REPLY : replyText)
          break
        }

        messages.push(response.message)
        for (const toolCall of response.toolCalls) {
          toolCallLog.push(toolCall.name)
          const output = await executeAiTool(
            toolCall.name,
            toolCall.arguments,
            { actorId, workspaceId },
          )
          messages.push({
            role: 'tool',
            toolCallId: toolCall.id,
            name: toolCall.name,
            content: output,
          })
        }

        if (round === MAX_TOOL_ROUNDS - 1) {
          replyText =
            'Não consegui concluir isso agora — precisou de mais etapas do que o permitido. Tente reformular a pergunta em partes menores.'
        }
      }
    } catch (error) {
      logger.error('crm_ai.provider_failed', {
        component: 'CrmAiConversationService',
        conversationId,
        workspaceId,
        provider: call.model.provider,
        model: call.model.model,
        message: error instanceof Error ? error.message : String(error),
      })
      // O que já foi consumido antes da falha conta na cota.
      await AiUsageService.record(call, { workspaceId, userId: actorId, usage })
      return err(
        aiProviderUnavailable(
          'Não foi possível falar com o provedor de IA agora. Tente novamente em instantes.',
        ),
      )
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

    await Promise.all([
      AiUsageService.record(call, { workspaceId, userId: actorId, usage }),
      CrmAiUsageRepository.record({
        workspaceId,
        conversationId,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        model: call.model.model,
      }),
    ])

    await CrmAiConversationRepository.touch(conversationId)

    return ok(toCrmAiMessageDTO(assistantMessage.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    conversationId: string,
  ): Promise<Result<void>> {
    const membership = await assertModuleMember(actorId, workspaceId, 'CRM')
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
    const membership = await assertModuleMember(actorId, workspaceId, 'CRM')
    if (!membership.ok) return membership
    const feature = await assertFeature(workspaceId, 'crm.aiAssistant')
    if (!feature.ok) return feature

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
