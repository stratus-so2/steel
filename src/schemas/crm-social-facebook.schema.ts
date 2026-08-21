import z from 'zod'

/**
 * Contratos da camada de dados do Facebook (sobre a `CrmSocialConnection` já
 * conectada via OAuth). Três capacidades: visão da Página (overview),
 * analytics (insights) e publicação. O Facebook publica numa **Página**, não
 * no perfil — a conexão guarda o id e o Page token (ver `providers/facebook.ts`).
 */

export const CrmFacebookPageOverviewSchema = z.object({
  pageId: z.string(),
  name: z.string(),
  about: z.string().nullable(),
  link: z.string().nullable(),
  pictureUrl: z.string().nullable(),
  fanCount: z.number().int().nonnegative(),
  followersCount: z.number().int().nonnegative(),
})

export type CrmFacebookPageOverview = z.infer<
  typeof CrmFacebookPageOverviewSchema
>

/** Janelas de tempo aceitas pelos insights. O service traduz para datas. */
export const CrmFacebookInsightsRangeSchema = z
  .enum(['7d', '28d', '90d'])
  .default('28d')

export type CrmFacebookInsightsRange = z.infer<
  typeof CrmFacebookInsightsRangeSchema
>

/** Quantos dias cada janela representa (para montar o `since`). */
export const CRM_FB_INSIGHTS_RANGE_DAYS: Record<
  CrmFacebookInsightsRange,
  number
> = {
  '7d': 7,
  '28d': 28,
  '90d': 90,
}

export const CrmFacebookInsightsPointSchema = z.object({
  date: z.string(),
  impressions: z.number().int().nonnegative(),
  engagements: z.number().int().nonnegative(),
  fanAdds: z.number().int(),
})

export type CrmFacebookInsightsPoint = z.infer<
  typeof CrmFacebookInsightsPointSchema
>

export const CrmFacebookInsightsSchema = z.object({
  range: CrmFacebookInsightsRangeSchema,
  startDate: z.string(),
  endDate: z.string(),
  totals: z.object({
    impressions: z.number().int().nonnegative(),
    engagements: z.number().int().nonnegative(),
    fanAdds: z.number().int(),
  }),
  series: z.array(CrmFacebookInsightsPointSchema),
})

export type CrmFacebookInsights = z.infer<typeof CrmFacebookInsightsSchema>

/**
 * Conteúdo da publicação. A imagem (opcional) NÃO entra aqui — vem como
 * `File` no `multipart/form-data`, validado na rota. Exigimos mensagem OU
 * link (publicação vazia não faz sentido).
 */
export const CrmPublishFacebookPostSchema = z
  .object({
    message: z.string().trim().max(5000).default(''),
    link: z.url('Link inválido').nullable().default(null),
  })
  .refine((v) => v.message.length > 0 || v.link !== null, {
    message: 'Informe uma mensagem ou um link',
    path: ['message'],
  })

export type CrmPublishFacebookPostInput = z.infer<
  typeof CrmPublishFacebookPostSchema
>

export const CrmPublishFacebookPostResultSchema = z.object({
  postId: z.string(),
  url: z.string(),
})

export type CrmPublishFacebookPostResult = z.infer<
  typeof CrmPublishFacebookPostResultSchema
>

export const CrmFacebookPostSchema = z.object({
  id: z.string(),
  message: z.string().nullable(),
  story: z.string().nullable(),
  fullPicture: z.string().nullable(),
  permalinkUrl: z.string().nullable(),
  createdTime: z.string(),
  isVideo: z.boolean(),
})

export type CrmFacebookPost = z.infer<typeof CrmFacebookPostSchema>

export const CrmFacebookPostsSchema = z.object({
  posts: z.array(CrmFacebookPostSchema),
})

export type CrmFacebookPosts = z.infer<typeof CrmFacebookPostsSchema>
