import { z } from 'zod'

/**
 * KCS (Knowledge-Centered Service) da base de conhecimento do ServiceDesk:
 * artigo nascido do chamado, ciclo `DRAFT → IN_REVIEW → PUBLISHED`, validade
 * da revisão e métrica de reuso (quantos chamados o artigo resolveu).
 */

export const SD_KB_REVIEW_STATUSES = [
  'PENDING',
  'APPROVED',
  'CHANGES_REQUESTED',
] as const

export const SdKbReviewStatusEnum = z.enum(SD_KB_REVIEW_STATUSES)

export const SD_KB_REVIEW_DECISIONS = ['APPROVE', 'REQUEST_CHANGES'] as const

export const SdKbReviewDecisionEnum = z.enum(SD_KB_REVIEW_DECISIONS)

/** Validade da revisão: de 1 dia a 10 anos (`null` = sem validade). */
export const SD_KB_REVIEW_MIN_DAYS = 1
export const SD_KB_REVIEW_MAX_DAYS = 3650
/** Padrão de fábrica quando o workspace não mexeu na configuração. */
export const SD_KB_REVIEW_DEFAULT_DAYS = 180

const id = z.string().trim().min(1).max(64)

const comment = z
  .string()
  .trim()
  .max(2000, 'Comentário deve ter no máximo 2000 caracteres')

const reviewIntervalDays = z
  .number()
  .int()
  .min(SD_KB_REVIEW_MIN_DAYS, 'A validade deve ser de ao menos 1 dia')
  .max(SD_KB_REVIEW_MAX_DAYS, 'A validade deve ser de no máximo 3650 dias')

export const RequestSdKbReviewSchema = z.object({
  reviewerId: id,
  comment: comment.optional(),
})

export type RequestSdKbReviewDTO = z.infer<typeof RequestSdKbReviewSchema>

/**
 * Decisão do revisor. `REQUEST_CHANGES` exige comentário — é o que o autor
 * vai ler para saber o que corrigir.
 */
export const DecideSdKbReviewSchema = z
  .object({
    decision: SdKbReviewDecisionEnum,
    comment: comment.optional(),
    /** Só na aprovação: valida por outro prazo que não o do artigo. */
    reviewIntervalDays: reviewIntervalDays.nullable().optional(),
  })
  .refine(
    (data) => data.decision !== 'REQUEST_CHANGES' || Boolean(data.comment),
    { message: 'Diga o que precisa mudar', path: ['comment'] },
  )

export type DecideSdKbReviewDTO = z.infer<typeof DecideSdKbReviewSchema>

export const SetSdKbReviewIntervalSchema = z.object({
  reviewIntervalDays: reviewIntervalDays.nullable(),
})

export type SetSdKbReviewIntervalDTO = z.infer<
  typeof SetSdKbReviewIntervalSchema
>

export const UpdateSdKbReviewSettingsSchema = z.object({
  defaultIntervalDays: reviewIntervalDays,
})

export type UpdateSdKbReviewSettingsDTO = z.infer<
  typeof UpdateSdKbReviewSettingsSchema
>

/** `mine=true`: só as revisões em que sou o revisor escolhido. */
export const ListSdKbReviewsSchema = z.object({
  status: SdKbReviewStatusEnum.optional(),
  mine: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type ListSdKbReviewsDTO = z.infer<typeof ListSdKbReviewsSchema>

/** Marca (ou desmarca) o artigo como o que resolveu o chamado. */
export const MarkSdKbResolvedSchema = z.object({
  ticketId: id,
  resolved: z.boolean(),
})

export type MarkSdKbResolvedDTO = z.infer<typeof MarkSdKbResolvedSchema>

export const SdKbStatsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5),
})

export type SdKbStatsDTO = z.infer<typeof SdKbStatsSchema>

/**
 * Artigo a partir do chamado. `useAi=false` entrega o esqueleto KCS vazio
 * (também é o que acontece quando a IA está desligada ou indisponível).
 */
export const DraftSdKbArticleFromTicketSchema = z.object({
  ticketId: id,
  useAi: z.boolean().optional().default(true),
  categoryId: id.optional(),
  parentId: id.optional(),
})

export type DraftSdKbArticleFromTicketDTO = z.infer<
  typeof DraftSdKbArticleFromTicketSchema
>

/**
 * Sugestões para um chamado que ainda não existe (tela de abertura): os
 * termos vêm do título/descrição digitados e das categorias escolhidas.
 */
export const SuggestSdKbForDraftSchema = z.object({
  title: z.string().trim().max(255).optional().default(''),
  description: z.string().trim().max(10_000).optional().default(''),
  categoryIds: z.array(id).max(3).optional().default([]),
  limit: z.coerce.number().int().min(1).max(20).default(5),
})

export type SuggestSdKbForDraftDTO = z.infer<typeof SuggestSdKbForDraftSchema>

/* --------------------------- rascunho da IA ------------------------------ */

const section = z
  .array(z.string().trim().max(2000))
  .max(20)
  .catch([])
  .default([])

/**
 * Saída da IA para o rascunho KCS: cada seção é uma lista de parágrafos.
 * Tudo tolerante (`catch`) — um campo malformado não derruba o rascunho, só
 * deixa a seção com o texto-guia do esqueleto.
 */
export const SdKcsDraftOutputSchema = z.object({
  title: z.string().trim().max(255).catch('').default(''),
  problem: section,
  environment: section,
  cause: section,
  solution: section,
  validation: section,
  tags: z
    .array(z.string().trim().toLowerCase().min(1).max(40))
    .max(8)
    .catch([])
    .default([]),
})

export type SdKcsDraftOutput = z.infer<typeof SdKcsDraftOutputSchema>

const stringList = { type: 'array', items: { type: 'string' } }

/** JSON Schema equivalente, para a saída estruturada do provedor. */
export const SD_KCS_DRAFT_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    problem: stringList,
    environment: stringList,
    cause: stringList,
    solution: stringList,
    validation: stringList,
    tags: stringList,
  },
  required: [
    'title',
    'problem',
    'environment',
    'cause',
    'solution',
    'validation',
    'tags',
  ],
  additionalProperties: false,
}
