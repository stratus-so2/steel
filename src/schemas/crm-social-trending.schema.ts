import { z } from 'zod'
import { CRM_SOCIAL_PLATFORMS } from '@/src/schemas/crm-social.schema'

/**
 * "Em Alta": ranking dos posts de hoje (contas conectadas) por velocidade de
 * engajamento — quanto mais views/interações em menos tempo, mais em alta.
 * `views`/`saved` ficam `null` quando a plataforma não expõe a métrica.
 */
export const TrendingItemSchema = z.object({
  id: z.string(),
  platform: z.enum(CRM_SOCIAL_PLATFORMS),
  thumbnailUrl: z.string().nullable(),
  caption: z.string().nullable(),
  permalink: z.string().nullable(),
  postedAt: z.string(),
  views: z.number().int().nonnegative().nullable(),
  likes: z.number().int().nonnegative(),
  comments: z.number().int().nonnegative(),
  shares: z.number().int().nonnegative().nullable(),
  saved: z.number().int().nonnegative().nullable(),
  /** (views + interações) / horas desde a publicação. */
  score: z.number().nonnegative(),
})

export type TrendingItem = z.infer<typeof TrendingItemSchema>
