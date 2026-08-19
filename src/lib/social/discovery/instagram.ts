import {
  crmCompetitorProfileNotFound,
  crmSocialOauthFailed,
} from '@/src/errors'
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

type BusinessDiscoveryResponse = {
  business_discovery?: {
    followers_count?: number
    media_count?: number
    biography?: string
    profile_picture_url?: string
    name?: string
    username?: string
  }
}

/**
 * Métricas públicas de OUTRA conta IG Business/Creator via Business
 * Discovery — usa o token da nossa própria conta conectada para ler dados
 * públicos de um concorrente, sem ele precisar autorizar nada. Só funciona
 * para contas Business/Creator: contas pessoais, privadas ou inexistentes
 * fazem a Graph API devolver HTTP 400 (`"Invalid user id"`, code 110), não
 * um 200 sem o campo — por isso o 400 aqui vira `crmCompetitorProfileNotFound`
 * em vez do erro genérico de OAuth. Outros status (401/403/5xx) continuam
 * como falha real de conexão.
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
  const url = `${GRAPH}/${ownIgAccountId}?${params.toString()}`

  let response: Response
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${pageToken}` },
    })
  } catch (error) {
    console.error('[social] GET erro de rede', url, error)
    return err(crmSocialOauthFailed())
  }

  if (!response.ok) {
    if (response.status === 400) return err(crmCompetitorProfileNotFound())
    console.error(
      '[social] GET falhou',
      url,
      response.status,
      (await response.text().catch(() => '')).slice(0, 500),
    )
    return err(crmSocialOauthFailed())
  }

  const data = (await response.json()) as BusinessDiscoveryResponse
  const bd = data.business_discovery
  if (!bd) return err(crmCompetitorProfileNotFound())

  return ok({
    externalName: bd.name ?? (bd.username ? `@${bd.username}` : null),
    avatarUrl: bd.profile_picture_url ?? null,
    bio: bd.biography ?? null,
    followersCount: toInt(bd.followers_count),
    postsCount: bd.media_count != null ? toInt(bd.media_count) : null,
    profileUrl: bd.username ? `https://www.instagram.com/${bd.username}` : null,
  })
}
