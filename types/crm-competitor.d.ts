import type { CrmSocialPlatformDTO } from '@/types/crm-social'

export type CrmCompetitorSyncStatusDTO = 'MANUAL' | 'SYNCED' | 'SYNC_FAILED'

export interface CrmCompetitorDTO {
  id: string
  platform: CrmSocialPlatformDTO
  handle: string
  profileUrl: string | null
  followersCount: number | null
  avatarUrl: string | null
  displayName: string | null
  bio: string | null
  syncStatus: CrmCompetitorSyncStatusDTO
  lastSyncedAt: string | null
  notes: string | null
  workspaceId: string
  createdById: string
  updatedById: string | null
  position: number
  createdAt: string
  updatedAt: string
}

/** Preview de dados públicos buscados antes de salvar (não persistido). */
export interface CrmCompetitorPreviewDTO {
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  followersCount: number
  postsCount: number | null
  profileUrl: string | null
}

export interface CrmCompetitorMetricSnapshotDTO {
  id: string
  followersCount: number
  postsCount: number | null
  capturedAt: string
}

/** Variação absoluta e percentual entre o primeiro e o último snapshot da janela. */
export interface CrmCompetitorMetricGrowthDTO {
  absolute: number
  percent: number | null
}

/**
 * Posts de hoje (feed/reels/carrossel — sem stories, que não têm API pública
 * pra terceiros) e taxa de engajamento do dia. `null` quando a plataforma não
 * suporta essa busca (hoje: só Instagram) ou a busca falhou.
 */
export interface CrmCompetitorTodayStatsDTO {
  postsCount: number
  /** (curtidas + comentários) ÷ seguidores, dos posts de hoje. `null` sem seguidores. */
  engagementRate: number | null
}

export interface CrmCompetitorMetricsSeriesDTO {
  followersCount: number | null
  growth: CrmCompetitorMetricGrowthDTO | null
  snapshots: CrmCompetitorMetricSnapshotDTO[]
  todayStats: CrmCompetitorTodayStatsDTO | null
}

/** Concorrente vs. conta conectada da mesma plataforma no workspace (se houver). */
export interface CrmCompetitorMetricsDTO {
  range: '7d' | '30d' | '90d'
  competitor: CrmCompetitorMetricsSeriesDTO
  ownAccount:
    | (CrmCompetitorMetricsSeriesDTO & {
        connectionId: string
        accountName: string | null
      })
    | null
}

/** Normalized post format (Instagram and YouTube share one vocabulary). */
export type CrmSocialPostFormatDTO =
  | 'IMAGE'
  | 'CAROUSEL'
  | 'VIDEO'
  | 'REELS'
  | 'SHORT'

export interface CrmSocialPostDTO {
  externalId: string
  format: CrmSocialPostFormatDTO
  caption: string | null
  permalink: string | null
  /** `null` = likes hidden by the profile owner. */
  likeCount: number | null
  commentsCount: number | null
  viewCount: number | null
  /** Likes + comments; `null` when the platform reported neither. */
  interactions: number | null
  publishedAt: string
}

export type CrmPostDaypartDTO = 'DAWN' | 'MORNING' | 'AFTERNOON' | 'EVENING'

export interface CrmPostBucketStatsDTO {
  postsCount: number
  /** Average likes + comments of the posts in the group. */
  avgInteractions: number | null
}

/**
 * Metrics of one account (competitor or own) over the window, computed
 * without AI from the collected posts (`src/lib/social/post-analytics.ts`).
 */
export interface CrmPostStatsDTO {
  postsCount: number
  postsPerWeek: number
  avgInteractions: number | null
  /** Average interactions per post ÷ followers × 100. */
  engagementRate: number | null
  avgViews: number | null
  hiddenLikesCount: number
  avgCaptionLength: number | null
  formats: (CrmPostBucketStatsDTO & {
    format: CrmSocialPostFormatDTO
    /** Share of the window's posts, 0–100. */
    share: number
  })[]
  /** Seven slots, Sunday (0) to Saturday (6), in the São Paulo timezone. */
  weekdays: (CrmPostBucketStatsDTO & { weekday: number })[]
  dayparts: (CrmPostBucketStatsDTO & { daypart: CrmPostDaypartDTO })[]
  hashtags: (CrmPostBucketStatsDTO & { tag: string })[]
  topPosts: CrmSocialPostDTO[]
}

export type CrmCompetitorInsightToneDTO = 'positive' | 'negative' | 'neutral'

/** Comparative reading ready for the screen (fixed rules, no AI). */
export interface CrmCompetitorInsightDTO {
  key: string
  tone: CrmCompetitorInsightToneDTO
  text: string
}

export interface CrmCompetitorAnalysisDTO {
  range: '7d' | '30d' | '90d'
  competitor: CrmCompetitorDTO
  competitorStats: CrmPostStatsDTO
  ownAccount: {
    connectionId: string
    accountName: string | null
    followersCount: number | null
    stats: CrmPostStatsDTO
  } | null
  insights: CrmCompetitorInsightDTO[]
}

export interface CrmCompetitorIdeaDTO {
  title: string
  format: CrmSocialPostFormatDTO
  hook: string
  caption: string
  rationale: string
  hashtags: string[]
}

export interface CrmCompetitorIdeaSetDTO {
  id: string
  competitorId: string
  range: '7d' | '30d' | '90d'
  ideas: CrmCompetitorIdeaDTO[]
  modelKey: string
  createdById: string | null
  createdAt: string
}
