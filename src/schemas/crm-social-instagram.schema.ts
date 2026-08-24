import z from 'zod'

/**
 * Contratos da camada de dados do Instagram (sobre a `CrmSocialConnection` já
 * conectada via OAuth). Três capacidades: visão do perfil (overview),
 * analytics (insights da conta IG Business/Creator) e publicação. O Instagram
 * publica via Graph API com fluxo de 2 passos (`/media` → `/media_publish`) e
 * exige mídia hospedada em URL pública — resolvido pelo `blob-store`.
 */

export const CrmInstagramProfileOverviewSchema = z.object({
  igAccountId: z.string(),
  username: z.string(),
  name: z.string().nullable(),
  biography: z.string().nullable(),
  profilePictureUrl: z.string().nullable(),
  mediaCount: z.number().int().nonnegative(),
  followersCount: z.number().int().nonnegative(),
  followsCount: z.number().int().nonnegative(),
})

export type CrmInstagramProfileOverview = z.infer<
  typeof CrmInstagramProfileOverviewSchema
>

/** Janelas de tempo aceitas pelos insights. O service traduz para datas. */
export const CrmInstagramInsightsRangeSchema = z
  .enum(['7d', '28d', '90d'])
  .default('28d')

export type CrmInstagramInsightsRange = z.infer<
  typeof CrmInstagramInsightsRangeSchema
>

/** Quantos dias cada janela representa (para montar o `since`). */
export const CRM_IG_INSIGHTS_RANGE_DAYS: Record<
  CrmInstagramInsightsRange,
  number
> = {
  '7d': 7,
  '28d': 28,
  '90d': 90,
}

export const CrmInstagramInsightsPointSchema = z.object({
  date: z.string(),
  impressions: z.number().int().nonnegative(),
  reach: z.number().int().nonnegative(),
  profileViews: z.number().int().nonnegative(),
})

export type CrmInstagramInsightsPoint = z.infer<
  typeof CrmInstagramInsightsPointSchema
>

export const CrmInstagramInsightsSchema = z.object({
  range: CrmInstagramInsightsRangeSchema,
  startDate: z.string(),
  endDate: z.string(),
  totals: z.object({
    impressions: z.number().int().nonnegative(),
    reach: z.number().int().nonnegative(),
    profileViews: z.number().int().nonnegative(),
  }),
  series: z.array(CrmInstagramInsightsPointSchema),
})

export type CrmInstagramInsights = z.infer<typeof CrmInstagramInsightsSchema>

/**
 * Modelo de publicação. O Graph API distingue três formatos, cada um exigindo
 * uma mídia diferente:
 * - `FEED`: foto no feed (imagem).
 * - `REELS`: vídeo curto (`media_type=REELS`, exige vídeo).
 * - `STORIES`: story de 24h (`media_type=STORIES`, aceita imagem ou vídeo).
 */
export const CrmInstagramPostTypeSchema = z.enum(['FEED', 'REELS', 'STORIES'])
export type CrmInstagramPostType = z.infer<typeof CrmInstagramPostTypeSchema>

export const CRM_INSTAGRAM_POST_TYPE_LABELS: Record<
  CrmInstagramPostType,
  string
> = {
  FEED: 'Publicação (feed)',
  REELS: 'Reels',
  STORIES: 'Stories',
}

/**
 * Conteúdo da publicação. A mídia (obrigatória) NÃO entra aqui — vem como
 * `File` no `multipart/form-data`, validada na rota. Limite de 2200 chars na
 * API (legenda é ignorada em `STORIES`).
 */
export const CrmPublishInstagramPostSchema = z.object({
  caption: z.string().trim().max(2200).default(''),
  postType: CrmInstagramPostTypeSchema.default('FEED'),
})

export type CrmPublishInstagramPostInput = z.infer<
  typeof CrmPublishInstagramPostSchema
>

export const CrmPublishInstagramPostResultSchema = z.object({
  postId: z.string(),
  permalink: z.string().nullable(),
})

export type CrmPublishInstagramPostResult = z.infer<
  typeof CrmPublishInstagramPostResultSchema
>

export const CrmInstagramMediaSchema = z.object({
  id: z.string(),
  mediaType: z.enum(['IMAGE', 'VIDEO', 'CAROUSEL_ALBUM']),
  mediaUrl: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  caption: z.string().nullable(),
  timestamp: z.string(),
  permalink: z.string().nullable(),
  likeCount: z.number().int().nonnegative(),
  commentsCount: z.number().int().nonnegative(),
})

export type CrmInstagramMedia = z.infer<typeof CrmInstagramMediaSchema>

export const CrmInstagramMediaListSchema = z.object({
  media: z.array(CrmInstagramMediaSchema),
})

export type CrmInstagramMediaList = z.infer<typeof CrmInstagramMediaListSchema>

/** Mídia recente + `saved` (insight por post) + score de engajamento. */
export const CrmInstagramMediaEngagementSchema = CrmInstagramMediaSchema.extend(
  {
    saved: z.number().int().nonnegative(),
    engagementScore: z.number().nonnegative(),
  },
)

export type CrmInstagramMediaEngagement = z.infer<
  typeof CrmInstagramMediaEngagementSchema
>

/** Resumo semanal: views/saves/visitas ao perfil + top 5 posts mais quentes. */
export const CrmInstagramWeeklyEngagementSchema = z.object({
  views7d: z.number().int().nonnegative(),
  saves7d: z.number().int().nonnegative(),
  profileViews7d: z.number().int().nonnegative(),
  top5: z.array(CrmInstagramMediaEngagementSchema).max(5),
})

export type CrmInstagramWeeklyEngagement = z.infer<
  typeof CrmInstagramWeeklyEngagementSchema
>

/**
 * Story ativa (últimas 24h) — a Graph API só devolve o que ainda não
 * expirou, sem histórico. Sem `caption`/`like_count`/`comments_count`: a
 * API não expõe esses campos pra stories. `reach` é o único proxy de
 * engajamento disponível.
 */
export const CrmInstagramActiveStorySchema = z.object({
  id: z.string(),
  mediaUrl: z.string().nullable(),
  timestamp: z.string(),
  permalink: z.string().nullable(),
  reach: z.number().int().nonnegative(),
})

export type CrmInstagramActiveStory = z.infer<
  typeof CrmInstagramActiveStorySchema
>

export const CrmInstagramStoriesListSchema = z.object({
  stories: z.array(CrmInstagramActiveStorySchema),
})

export type CrmInstagramStoriesList = z.infer<
  typeof CrmInstagramStoriesListSchema
>

export const CrmDeleteInstagramMediaResultSchema = z.object({
  deletedId: z.string(),
})

export type CrmDeleteInstagramMediaResult = z.infer<
  typeof CrmDeleteInstagramMediaResultSchema
>
