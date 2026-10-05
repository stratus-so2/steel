import z from 'zod'

/**
 * Plataformas com autofill/sync automático (Instagram Business Discovery e
 * YouTube Data API, ambas via token da conta já conectada no workspace —
 * ver `src/lib/social/discovery/`). As demais plataformas do
 * `CrmSocialPlatform` não têm API pública de descoberta viável e ficaram de
 * fora do cadastro de concorrentes.
 */
export const CRM_COMPETITOR_SYNCABLE_PLATFORMS = [
  'INSTAGRAM',
  'YOUTUBE',
] as const

export const CreateCrmCompetitorSchema = z.object({
  platform: z.enum(CRM_COMPETITOR_SYNCABLE_PLATFORMS),
  handle: z.string().trim().min(1, 'Informe o @ ou nome do perfil').max(200),
  profileUrl: z.url('Informe uma URL válida').max(500).nullable().optional(),
  followersCount: z.number().int().min(0).nullable().optional(),
  avatarUrl: z.url('Informe uma URL válida').max(1000).nullable().optional(),
  displayName: z.string().trim().max(200).nullable().optional(),
  bio: z.string().trim().max(2000).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
})

export type CreateCrmCompetitorDTO = z.infer<typeof CreateCrmCompetitorSchema>

export const UpdateCrmCompetitorSchema = z
  .object({
    platform: z.enum(CRM_COMPETITOR_SYNCABLE_PLATFORMS),
    handle: z.string().trim().min(1, 'Informe o @ ou nome do perfil').max(200),
    profileUrl: z.url('Informe uma URL válida').max(500).nullable(),
    followersCount: z.number().int().min(0).nullable(),
    avatarUrl: z.url('Informe uma URL válida').max(1000).nullable(),
    displayName: z.string().trim().max(200).nullable(),
    bio: z.string().trim().max(2000).nullable(),
    notes: z.string().trim().max(2000).nullable(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualizar',
  })

export type UpdateCrmCompetitorDTO = z.infer<typeof UpdateCrmCompetitorSchema>

export const ReorderCrmCompetitorsSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
})

export type ReorderCrmCompetitorsDTO = z.infer<
  typeof ReorderCrmCompetitorsSchema
>

/** Busca automática de dados públicos (preview antes de salvar). */
export const PreviewCrmCompetitorSchema = z.object({
  platform: z.enum(CRM_COMPETITOR_SYNCABLE_PLATFORMS),
  handle: z.string().trim().min(1, 'Informe o @ ou nome do perfil').max(200),
})

export type PreviewCrmCompetitorDTO = z.infer<typeof PreviewCrmCompetitorSchema>

export const CRM_COMPETITOR_METRICS_RANGES = ['7d', '30d', '90d'] as const
export type CrmCompetitorMetricsRange =
  (typeof CRM_COMPETITOR_METRICS_RANGES)[number]

export const CrmCompetitorMetricsQuerySchema = z.object({
  range: z.enum(CRM_COMPETITOR_METRICS_RANGES).default('30d'),
})

export const CRM_SOCIAL_POST_FORMATS = [
  'IMAGE',
  'CAROUSEL',
  'VIDEO',
  'REELS',
  'SHORT',
] as const

export const CRM_SOCIAL_POST_FORMAT_LABELS: Record<
  (typeof CRM_SOCIAL_POST_FORMATS)[number],
  string
> = {
  IMAGE: 'Imagem',
  CAROUSEL: 'Carrossel',
  VIDEO: 'Vídeo',
  REELS: 'Reels',
  SHORT: 'Shorts',
}

/** Ideas request: the analysis window that grounds the prompt. */
export const GenerateCrmCompetitorIdeasSchema = z.object({
  range: z.enum(CRM_COMPETITOR_METRICS_RANGES).default('30d'),
})

export type GenerateCrmCompetitorIdeasDTO = z.infer<
  typeof GenerateCrmCompetitorIdeasSchema
>

/** Number of ideas asked from the model per generation. */
export const CRM_COMPETITOR_IDEAS_COUNT = 5

/** Expected model output, validated before it is stored. */
export const CrmCompetitorIdeaSchema = z.object({
  title: z.string().trim().min(1).max(200),
  format: z.enum(CRM_SOCIAL_POST_FORMATS),
  hook: z.string().trim().min(1).max(500),
  caption: z.string().trim().min(1).max(2200),
  rationale: z.string().trim().min(1).max(1000),
  hashtags: z.array(z.string().trim().min(1).max(100)).max(15),
})

export const CrmCompetitorIdeasOutputSchema = z.object({
  ideas: z.array(CrmCompetitorIdeaSchema).min(1).max(10),
})

/** Same contract as JSON Schema, for both providers' structured output. */
export const CRM_COMPETITOR_IDEAS_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['ideas'],
  properties: {
    ideas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'title',
          'format',
          'hook',
          'caption',
          'rationale',
          'hashtags',
        ],
        properties: {
          title: { type: 'string' },
          format: { type: 'string', enum: [...CRM_SOCIAL_POST_FORMATS] },
          hook: { type: 'string' },
          caption: { type: 'string' },
          rationale: { type: 'string' },
          hashtags: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
}
