import type { Result } from '@/src/lib/result'
import type { CRM_COMPETITOR_SYNCABLE_PLATFORMS } from '@/src/schemas/crm-competitor.schema'
import {
  fetchInstagramCompetitorPosts,
  fetchInstagramOwnMetrics,
  fetchInstagramOwnPosts,
  fetchInstagramPublicProfile,
} from './instagram'
import type { DiscoveredPost, DiscoveredProfile, OwnMetrics } from './types'
import {
  fetchYoutubeChannelPosts,
  fetchYoutubeOwnMetrics,
  fetchYoutubePublicProfile,
} from './youtube'

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

/** Platform → latest public posts of a competitor. */
const COMPETITOR_POSTS: Record<
  SyncablePlatform,
  (
    accessToken: string,
    ownExternalAccountId: string,
    handle: string,
  ) => Promise<Result<DiscoveredPost[]>>
> = {
  INSTAGRAM: fetchInstagramCompetitorPosts,
  YOUTUBE: (accessToken, _ownExternalAccountId, handle) =>
    fetchYoutubeChannelPosts(accessToken, { handle }),
}

/** Platform → latest posts of the connected account. */
const OWN_POSTS: Record<
  SyncablePlatform,
  (
    accessToken: string,
    ownExternalAccountId: string,
  ) => Promise<Result<DiscoveredPost[]>>
> = {
  INSTAGRAM: fetchInstagramOwnPosts,
  YOUTUBE: (accessToken) =>
    fetchYoutubeChannelPosts(accessToken, { mine: true }),
}

export function fetchCompetitorPosts(
  platform: SyncablePlatform,
  accessToken: string,
  ownExternalAccountId: string,
  handle: string,
): Promise<Result<DiscoveredPost[]>> {
  return COMPETITOR_POSTS[platform](accessToken, ownExternalAccountId, handle)
}

export function fetchOwnPosts(
  platform: SyncablePlatform,
  accessToken: string,
  ownExternalAccountId: string,
): Promise<Result<DiscoveredPost[]>> {
  return OWN_POSTS[platform](accessToken, ownExternalAccountId)
}

export type { DiscoveredPost, DiscoveredProfile, OwnMetrics } from './types'
