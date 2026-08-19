import { crmCompetitorProfileNotFound } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { getJson } from '../providers/http'
import type { DiscoveredProfile, OwnMetrics } from './types'

const GRAPH = 'https://graph.facebook.com/v21.0'

function toInt(value: unknown): number {
  const n =
    typeof value === 'string' ? Number.parseInt(value, 10) : Number(value)
  return Number.isFinite(n) ? n : 0
}

/** Métricas da PRÓPRIA conta IG conectada (sem o truque de Business Discovery). */
export async function fetchInstagramOwnMetrics(
  pageToken: string,
  igAccountId: string,
): Promise<Result<OwnMetrics>> {
  const params = new URLSearchParams({ fields: 'followers_count,media_count' })
  const result = await getJson<{
    followers_count?: number
    media_count?: number
  }>(`${GRAPH}/${igAccountId}?${params.toString()}`, pageToken)
  if (!result.ok) return result

  return ok({
    followersCount: toInt(result.value.followers_count),
    postsCount:
      result.value.media_count != null ? toInt(result.value.media_count) : null,
  })
}

/**
 * Métricas públicas de OUTRA conta IG Business/Creator via Business
 * Discovery — usa o token da nossa própria conta conectada para ler dados
 * públicos de um concorrente, sem ele precisar autorizar nada. Perfis
 * privados ou pessoais (não Business/Creator) simplesmente não retornam o
 * campo `business_discovery` (não é um erro HTTP), então a ausência vira
 * `crmCompetitorProfileNotFound`.
 */
export async function fetchInstagramPublicProfile(
  pageToken: string,
  ownIgAccountId: string,
  handle: string,
): Promise<Result<DiscoveredProfile>> {
  const username = handle.trim().replace(/^@/, '')
  const params = new URLSearchParams({
    fields: `business_discovery.username(${username}){followers_count,media_count,biography,profile_picture_url,name,username}`,
  })
  const result = await getJson<{
    business_discovery?: {
      followers_count?: number
      media_count?: number
      biography?: string
      profile_picture_url?: string
      name?: string
      username?: string
    }
  }>(`${GRAPH}/${ownIgAccountId}?${params.toString()}`, pageToken)
  if (!result.ok) return result

  const bd = result.value.business_discovery
  if (!bd) return err(crmCompetitorProfileNotFound())

  return ok({
    externalName: bd.name ?? (bd.username ? `@${bd.username}` : null),
    avatarUrl: bd.profile_picture_url ?? null,
    bio: bd.biography ?? null,
    followersCount: toInt(bd.followers_count),
    postsCount: bd.media_count != null ? toInt(bd.media_count) : null,
  })
}
