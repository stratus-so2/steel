import type { Result } from '@/src/lib/result'
import type { CRM_COMPETITOR_SYNCABLE_PLATFORMS } from '@/src/schemas/crm-competitor.schema'
import {
  fetchInstagramOwnMetrics,
  fetchInstagramPublicProfile,
} from './instagram'
import type { DiscoveredProfile, OwnMetrics } from './types'
import { fetchYoutubeOwnMetrics, fetchYoutubePublicProfile } from './youtube'

export type SyncablePlatform =
  (typeof CRM_COMPETITOR_SYNCABLE_PLATFORMS)[number]

/**
 * Registro plataforma → busca de perfil público. `ownExternalAccountId` só é
 * usado pelo Instagram (Business Discovery é feito "a partir" da própria
 * conta IG); o YouTube ignora o parâmetro.
 */
const DISCOVERY: Record<
  SyncablePlatform,
  (
    accessToken: string,
    ownExternalAccountId: string,
    handle: string,
  ) => Promise<Result<DiscoveredProfile>>
> = {
  INSTAGRAM: fetchInstagramPublicProfile,
  YOUTUBE: (accessToken, _ownExternalAccountId, handle) =>
    fetchYoutubePublicProfile(accessToken, handle),
}

/** Registro plataforma → métricas da própria conta conectada. */
const OWN_METRICS: Record<
  SyncablePlatform,
  (
    accessToken: string,
    ownExternalAccountId: string,
  ) => Promise<Result<OwnMetrics>>
> = {
  INSTAGRAM: fetchInstagramOwnMetrics,
  YOUTUBE: (accessToken) => fetchYoutubeOwnMetrics(accessToken),
}

export function fetchPublicProfile(
  platform: SyncablePlatform,
  accessToken: string,
  ownExternalAccountId: string,
  handle: string,
): Promise<Result<DiscoveredProfile>> {
  return DISCOVERY[platform](accessToken, ownExternalAccountId, handle)
}

export function fetchOwnMetrics(
  platform: SyncablePlatform,
  accessToken: string,
  ownExternalAccountId: string,
): Promise<Result<OwnMetrics>> {
  return OWN_METRICS[platform](accessToken, ownExternalAccountId)
}

export type { DiscoveredProfile, OwnMetrics } from './types'
