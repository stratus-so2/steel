import { z } from 'zod'

/** Visão do perfil: só identidade (métricas exigem plano pago do X). */
export const CrmTwitterProfileOverviewSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string().nullable(),
  profileImageUrl: z.string().nullable(),
})

export type CrmTwitterProfileOverview = z.infer<
  typeof CrmTwitterProfileOverviewSchema
>

/** Limite de 280 chars da API do X. A imagem (opcional) vem como `File` na rota. */
export const CrmPublishTweetSchema = z.object({
  text: z.string().trim().min(1, 'O tweet não pode ficar vazio').max(280),
})

export type CrmPublishTweetInput = z.infer<typeof CrmPublishTweetSchema>

export const CrmPublishTweetResultSchema = z.object({
  tweetId: z.string(),
  permalink: z.string().nullable(),
})

export type CrmPublishTweetResult = z.infer<typeof CrmPublishTweetResultSchema>

export const CrmTweetSchema = z.object({
  id: z.string(),
  text: z.string(),
  createdAt: z.string().nullable(),
  url: z.string(),
  metrics: z
    .object({
      likeCount: z.number().int().nonnegative(),
      retweetCount: z.number().int().nonnegative(),
      replyCount: z.number().int().nonnegative(),
      impressionCount: z.number().int().nonnegative(),
    })
    .nullable(),
})

export type CrmTweet = z.infer<typeof CrmTweetSchema>

export const CrmTweetsSchema = z.object({
  tweets: z.array(CrmTweetSchema),
})

export type CrmTweets = z.infer<typeof CrmTweetsSchema>
