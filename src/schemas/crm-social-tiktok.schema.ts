import { z } from 'zod'

/**
 * O TikTok não expõe série temporal de insights para contas pessoais — o
 * análogo é a lista de vídeos recentes com estatísticas por vídeo (usada
 * também para o resumo semanal de engajamento).
 */
export const CrmTiktokCreatorOverviewSchema = z.object({
  openId: z.string(),
  displayName: z.string(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  profileLink: z.string().nullable(),
  isVerified: z.boolean(),
  followerCount: z.number().int().nonnegative(),
  followingCount: z.number().int().nonnegative(),
  likesCount: z.number().int().nonnegative(),
  videoCount: z.number().int().nonnegative(),
})

export type CrmTiktokCreatorOverview = z.infer<
  typeof CrmTiktokCreatorOverviewSchema
>

export const CrmTiktokVideoSchema = z.object({
  id: z.string(),
  title: z.string(),
  coverImageUrl: z.string().nullable(),
  shareUrl: z.string().nullable(),
  embedLink: z.string().nullable(),
  duration: z.number().int().nonnegative(),
  createdAt: z.string(),
  viewCount: z.number().int().nonnegative(),
  likeCount: z.number().int().nonnegative(),
  commentCount: z.number().int().nonnegative(),
  shareCount: z.number().int().nonnegative(),
})

export type CrmTiktokVideo = z.infer<typeof CrmTiktokVideoSchema>

export const CrmTiktokVideosSchema = z.object({
  totals: z.object({
    views: z.number().int().nonnegative(),
    likes: z.number().int().nonnegative(),
    comments: z.number().int().nonnegative(),
    shares: z.number().int().nonnegative(),
  }),
  videos: z.array(CrmTiktokVideoSchema),
})

export type CrmTiktokVideos = z.infer<typeof CrmTiktokVideosSchema>

export const CrmTiktokVideoEngagementSchema = CrmTiktokVideoSchema.extend({
  engagementScore: z.number().nonnegative(),
})

export type CrmTiktokVideoEngagement = z.infer<
  typeof CrmTiktokVideoEngagementSchema
>

export const CrmTiktokWeeklyEngagementSchema = z.object({
  views7d: z.number().int().nonnegative(),
  top5: z.array(CrmTiktokVideoEngagementSchema).max(5),
})

export type CrmTiktokWeeklyEngagement = z.infer<
  typeof CrmTiktokWeeklyEngagementSchema
>

/**
 * Default conservador: SELF_ONLY é o único nível permitido enquanto o app
 * não passa pela auditoria da TikTok (Content Posting API).
 */
export const CrmTiktokPrivacySchema = z
  .enum([
    'SELF_ONLY',
    'FOLLOWER_OF_CREATOR',
    'MUTUAL_FOLLOW_FRIENDS',
    'PUBLIC_TO_EVERYONE',
  ])
  .default('SELF_ONLY')

export type CrmTiktokPrivacy = z.infer<typeof CrmTiktokPrivacySchema>

export const CrmPublishTiktokVideoSchema = z.object({
  title: z.string().trim().max(2200).default(''),
  privacyLevel: CrmTiktokPrivacySchema,
  disableComment: z.boolean().default(false),
  disableDuet: z.boolean().default(false),
  disableStitch: z.boolean().default(false),
})

export type CrmPublishTiktokVideoInput = z.infer<
  typeof CrmPublishTiktokVideoSchema
>

export const CrmPublishTiktokVideoResultSchema = z.object({
  publishId: z.string(),
  status: z.string(),
})

export type CrmPublishTiktokVideoResult = z.infer<
  typeof CrmPublishTiktokVideoResultSchema
>
