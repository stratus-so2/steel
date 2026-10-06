import { z } from 'zod'
import { dto } from '../common'

/** DTOs do Steel AI (`types/steel-ai.d.ts`). */

const dateTime = () => z.iso.datetime()
const AiModule = z.enum(['SERVICE_DESK', 'CRM', 'COMMUNICATION'])
const AiMode = z.enum(['EXPLORE', 'AGENT'])

export const AiCapabilitiesDTO = dto(
  'AiCapabilities',
  z.object({
    agentModeEnabled: z.boolean().meta({
      description:
        'Interruptor do workspace para o modo agente (ferramentas de escrita).',
    }),
    modules: z.array(AiModule).meta({
      description:
        'Módulos habilitados — as ferramentas que o Steel AI alcança.',
    }),
    modelKey: z.string().nullable().meta({
      description:
        'Modelo da próxima resposta (`<provider>:<model>`; preferência do usuário → padrão do workspace). `null` sem modelo utilizável.',
      example: 'openai:gpt-4o-mini',
    }),
    quota: z.object({ usedUsd: z.number(), quotaUsd: z.number() }),
  }),
)

export const AiConversationDTO = dto(
  'AiConversation',
  z
    .object({
      id: z.string().meta({ example: 'ckw1aicv0000ab7d3k1e5xyz' }),
      title: z.string().nullable(),
      mode: AiMode,
      modelKey: z.string().nullable(),
      pinnedAt: dateTime().nullable(),
      createdAt: dateTime(),
      updatedAt: dateTime(),
    })
    .meta({ description: 'Conversa com o Steel AI (privada do usuário).' }),
)

const AiToolCallDTO = z.object({
  id: z.string(),
  name: z.string().meta({ example: 'ws_overview' }),
  label: z.string().meta({ example: 'Consultando o workspace' }),
  module: AiModule.nullable(),
  status: z.enum(['running', 'done', 'error', 'pending_confirmation']),
  summary: z.string().optional(),
})

export const AiPendingActionDTO = dto(
  'AiPendingAction',
  z
    .object({
      id: z.string(),
      conversationId: z.string().nullable(),
      agentRunId: z.string().nullable(),
      toolName: z.string().meta({ example: 'crm_create_task' }),
      kind: z.enum(['CREATE', 'UPDATE', 'DELETE', 'ACTION']),
      module: AiModule.nullable(),
      preview: z.object({
        title: z.string(),
        summary: z.string(),
        fields: z
          .array(
            z.object({
              label: z.string(),
              before: z.string().nullable().optional(),
              after: z.string().nullable().optional(),
            }),
          )
          .optional(),
        target: z
          .object({
            type: z.string(),
            id: z.string().optional(),
            label: z.string(),
            href: z.string().optional(),
          })
          .optional(),
      }),
      status: z.enum(['PENDING', 'EXECUTED', 'FAILED', 'CANCELED', 'EXPIRED']),
      requiresDoubleConfirm: z.boolean().meta({
        description: 'Exclusões: confirme com `doubleConfirmed: true`.',
      }),
      resultSummary: z.string().nullable(),
      error: z.string().nullable(),
      expiresAt: dateTime(),
      decidedAt: dateTime().nullable(),
      executedAt: dateTime().nullable(),
      createdAt: dateTime(),
    })
    .meta({
      description:
        'Escrita proposta pelo Steel AI que só executa depois da confirmação humana.',
    }),
)

export const AiMessageDTO = dto(
  'AiMessage',
  z.object({
    id: z.string(),
    conversationId: z.string(),
    role: z.enum(['USER', 'ASSISTANT']),
    content: z.string(),
    toolCalls: z.array(AiToolCallDTO),
    pendingActions: z.array(AiPendingActionDTO),
    createdAt: dateTime(),
  }),
)
