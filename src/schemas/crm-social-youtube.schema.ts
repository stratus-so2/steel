import z from 'zod'

/**
 * Contratos da integração com o YouTube (sobre a `CrmSocialConnection` já
 * existente). Três capacidades: overview (identidade + estatísticas),
 * insights (analytics diário) e publish (upload de vídeo).
 */

export const CrmSocialYoutubeOverviewSchema = z.object({
  channelId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  customUrl: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  subscriberCount: z.number().int().nonnegative(),
  viewCount: z.number().int().nonnegative(),
  videoCount: z.number().int().nonnegative(),
})

export type CrmSocialYoutubeOverviewDTO = z.infer<
  typeof CrmSocialYoutubeOverviewSchema
>

export const CrmSocialYoutubeInsightsRangeSchema = z
  .enum(['7d', '28d', '90d', '365d'])
  .default('28d')

export type CrmSocialYoutubeInsightsRange = z.infer<
  typeof CrmSocialYoutubeInsightsRangeSchema
>

export const YOUTUBE_INSIGHTS_RANGE_DAYS: Record<
  CrmSocialYoutubeInsightsRange,
  number
> = {
  '7d': 7,
  '28d': 28,
  '90d': 90,
  '365d': 365,
}

export const CrmSocialYoutubeInsightsPointSchema = z.object({
  date: z.string(),
  views: z.number().int().nonnegative(),
  estimatedMinutesWatched: z.number().int().nonnegative(),
  subscribersGained: z.number().int(),
})

export type CrmSocialYoutubeInsightsPointDTO = z.infer<
  typeof CrmSocialYoutubeInsightsPointSchema
>

export const CrmSocialYoutubeInsightsSchema = z.object({
  range: CrmSocialYoutubeInsightsRangeSchema,
  startDate: z.string(),
  endDate: z.string(),
  totals: z.object({
    views: z.number().int().nonnegative(),
    estimatedMinutesWatched: z.number().int().nonnegative(),
    subscribersGained: z.number().int(),
  }),
  series: z.array(CrmSocialYoutubeInsightsPointSchema),
})

export type CrmSocialYoutubeInsightsDTO = z.infer<
  typeof CrmSocialYoutubeInsightsSchema
>

/** Default conservador: privado. */
export const CrmSocialYoutubePrivacySchema = z
  .enum(['private', 'unlisted', 'public'])
  .default('private')

export type CrmSocialYoutubePrivacy = z.infer<
  typeof CrmSocialYoutubePrivacySchema
>

/** O arquivo não entra aqui — vem como `File` no `multipart/form-data`. */
export const CrmSocialYoutubePublishVideoSchema = z.object({
  title: z.string().trim().min(1, 'Título é obrigatório').max(100),
  description: z.string().max(5000).default(''),
  privacyStatus: CrmSocialYoutubePrivacySchema,
  tags: z.array(z.string().trim().min(1)).max(30).default([]),
})

export type CrmSocialYoutubePublishVideoInput = z.infer<
  typeof CrmSocialYoutubePublishVideoSchema
>

export const CrmSocialYoutubePublishVideoResultSchema = z.object({
  videoId: z.string(),
  url: z.string(),
  title: z.string(),
  privacyStatus: CrmSocialYoutubePrivacySchema,
})

export type CrmSocialYoutubePublishVideoResultDTO = z.infer<
  typeof CrmSocialYoutubePublishVideoResultSchema
>

export const CrmSocialYoutubeVideoSchema = z.object({
  videoId: z.string(),
  title: z.string(),
  thumbnailUrl: z.string().nullable(),
  publishedAt: z.string(),
  url: z.string(),
  viewCount: z.number().int().nonnegative().default(0),
  likeCount: z.number().int().nonnegative().default(0),
  commentCount: z.number().int().nonnegative().default(0),
  duration: z.string().nullable().default(null),
})

export type CrmSocialYoutubeVideoDTO = z.infer<
  typeof CrmSocialYoutubeVideoSchema
>

export const CrmSocialYoutubeVideosSchema = z.object({
  videos: z.array(CrmSocialYoutubeVideoSchema),
})

export type CrmSocialYoutubeVideosDTO = z.infer<
  typeof CrmSocialYoutubeVideosSchema
>
