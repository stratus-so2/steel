import { z } from 'zod'
import { sdId } from './sd-config.schema'
import { SdTicketTypeEnum } from './sd-rule.schema'

/* ------------------------------------------------------------------ */
/* Entradas da API                                                      */
/* ------------------------------------------------------------------ */

const message = z
  .string()
  .trim()
  .min(1, 'Escreva uma mensagem')
  .max(4000, 'Mensagem muito longa (máx. 4000 caracteres)')

/** Sugestão de resposta pública (copiloto): orientação opcional do agente. */
export const SdAiReplyRequestSchema = z.object({
  instructions: z.string().trim().max(1000).optional(),
})
export type SdAiReplyRequestDTO = z.infer<typeof SdAiReplyRequestSchema>

/** Conversa livre com o copiloto sobre o chamado. */
export const SdAiChatMessageSchema = z.object({ message })
export type SdAiChatMessageDTO = z.infer<typeof SdAiChatMessageSchema>

/** Mensagem do solicitante no pré-atendimento (portal). */
export const SdAiPreServiceMessageSchema = z.object({
  conversationId: sdId.optional(),
  message,
})
export type SdAiPreServiceMessageDTO = z.infer<
  typeof SdAiPreServiceMessageSchema
>

/** "Abrir chamado" ao fim do pré-atendimento (o rascunho da IA é o padrão). */
export const SdAiPreServiceOpenTicketSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().max(10000).optional(),
  type: SdTicketTypeEnum.optional(),
})
export type SdAiPreServiceOpenTicketDTO = z.infer<
  typeof SdAiPreServiceOpenTicketSchema
>

export const SD_AI_CLOSE_OUTCOMES = ['resolved_by_kb', 'abandoned'] as const

/** Encerra o pré-atendimento sem chamado (resolvido pela base ou desistência). */
export const SdAiPreServiceCloseSchema = z.object({
  outcome: z.enum(SD_AI_CLOSE_OUTCOMES),
})
export type SdAiPreServiceCloseDTO = z.infer<typeof SdAiPreServiceCloseSchema>

/* ------------------------------------------------------------------ */
/* Saídas do modelo (validadas antes de usar — nunca confiar)           */
/* ------------------------------------------------------------------ */

const nullableId = z.string().min(1).max(64).nullable().catch(null)
const confidence = z.number().min(0).max(1).catch(0)

/** Triagem: ids do catálogo do workspace (a IA só escolhe entre eles). */
export const SdAiTriageOutputSchema = z.object({
  categoryId: nullableId,
  subcategoryId: nullableId,
  serviceId: nullableId,
  impactId: nullableId,
  urgencyId: nullableId,
  priorityId: nullableId,
  departmentId: nullableId,
  tags: z
    .array(z.string().trim().min(1).max(40))
    .max(10)
    .catch([])
    .transform((tags) => [...new Set(tags.map((t) => t.toLowerCase()))]),
  confidence,
  reasoning: z.string().max(2000).catch(''),
})
export type SdAiTriageOutput = z.infer<typeof SdAiTriageOutputSchema>

export const SD_AI_TURN_ACTIONS = [
  'answer',
  'collect_info',
  'resolved',
  'open_ticket',
] as const
export type SdAiTurnAction = (typeof SD_AI_TURN_ACTIONS)[number]

/** Rascunho do chamado montado pela IA durante o pré-atendimento. */
export const SdAiTicketDraftSchema = z.object({
  title: z.string().trim().max(200).catch(''),
  description: z.string().trim().max(10000).catch(''),
  type: SdTicketTypeEnum.nullable().catch(null),
  categoryId: nullableId,
  subcategoryId: nullableId,
  serviceId: nullableId,
  urgencyId: nullableId,
})
export type SdAiTicketDraft = z.infer<typeof SdAiTicketDraftSchema>

/** Um turno do assistente (pré-atendimento e resposta automática). */
export const SdAiTurnOutputSchema = z.object({
  reply: z.string().trim().min(1).max(4000),
  action: z.enum(SD_AI_TURN_ACTIONS).catch('answer'),
  articleIds: z.array(z.string().min(1).max(64)).max(5).catch([]),
  confidence,
  ticket: SdAiTicketDraftSchema.nullable().catch(null),
})
export type SdAiTurnOutput = z.infer<typeof SdAiTurnOutputSchema>

/* JSON Schema equivalente, para a saída estruturada do provedor. */

const nullableString = { type: ['string', 'null'] }

export const SD_AI_TRIAGE_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    categoryId: nullableString,
    subcategoryId: nullableString,
    serviceId: nullableString,
    impactId: nullableString,
    urgencyId: nullableString,
    priorityId: nullableString,
    departmentId: nullableString,
    tags: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number' },
    reasoning: { type: 'string' },
  },
  required: [
    'categoryId',
    'subcategoryId',
    'serviceId',
    'impactId',
    'urgencyId',
    'priorityId',
    'departmentId',
    'tags',
    'confidence',
    'reasoning',
  ],
  additionalProperties: false,
}

export const SD_AI_TURN_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    action: { type: 'string', enum: [...SD_AI_TURN_ACTIONS] },
    articleIds: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number' },
    ticket: {
      type: ['object', 'null'],
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        type: {
          type: ['string', 'null'],
          enum: ['INCIDENT', 'SERVICE_REQUEST', 'CHANGE', 'PROBLEM', null],
        },
        categoryId: nullableString,
        subcategoryId: nullableString,
        serviceId: nullableString,
        urgencyId: nullableString,
      },
      required: [
        'title',
        'description',
        'type',
        'categoryId',
        'subcategoryId',
        'serviceId',
        'urgencyId',
      ],
      additionalProperties: false,
    },
  },
  required: ['reply', 'action', 'articleIds', 'confidence', 'ticket'],
  additionalProperties: false,
}

/** Lê o JSON do modelo (tolera cercas ```json) e valida com o schema. */
export function parseSdAiJson<T extends z.ZodType>(
  schema: T,
  text: string,
): z.infer<T> | null {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  let raw: unknown
  try {
    raw = JSON.parse(trimmed)
  } catch {
    return null
  }
  const parsed = schema.safeParse(raw)
  return parsed.success ? parsed.data : null
}
