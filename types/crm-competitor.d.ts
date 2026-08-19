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
