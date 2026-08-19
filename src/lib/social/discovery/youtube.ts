import { crmCompetitorProfileNotFound } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { getJson } from '../providers/http'
import type { DiscoveredProfile, OwnMetrics } from './types'

function toInt(value: unknown): number {
  const n =
    typeof value === 'string' ? Number.parseInt(value, 10) : Number(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * A descrição de canal do YouTube pode passar de 5000 caracteres, bem acima
 * do `bio.max(2000)` de `CreateCrmCompetitorSchema`/`UpdateCrmCompetitorSchema`
 * — sem truncar aqui, o autofill quebraria ao salvar canais com descrição longa.
 */
const MAX_BIO_LENGTH = 2000

function truncateBio(bio: string | undefined): string | null {
  if (!bio) return null
  return bio.length > MAX_BIO_LENGTH ? bio.slice(0, MAX_BIO_LENGTH) : bio
}

/** Métricas do PRÓPRIO canal conectado (`mine=true`, sem busca por handle). */
export async function fetchYoutubeOwnMetrics(
  accessToken: string,
): Promise<Result<OwnMetrics>> {
  const params = new URLSearchParams({ part: 'statistics', mine: 'true' })
  const result = await getJson<{
    items?: {
      statistics?: { subscriberCount?: string; videoCount?: string }
    }[]
  }>(
    `https://www.googleapis.com/youtube/v3/channels?${params.toString()}`,
    accessToken,
  )
  if (!result.ok) return result

  const channel = result.value.items?.[0]
  if (!channel) return err(crmCompetitorProfileNotFound())

  return ok({
    followersCount: toInt(channel.statistics?.subscriberCount),
    postsCount:
      channel.statistics?.videoCount != null
        ? toInt(channel.statistics.videoCount)
        : null,
  })
}

/**
 * Métricas públicas de OUTRO canal do YouTube via `channels.list?forHandle=`
 * — endpoint de dados públicos, mas a API exige um Bearer token válido;
 * reusa o access token da nossa própria conta conectada, que funciona para
 * consultar qualquer canal público, não só o dono do token. Canal não
 * encontrado ou com contagem de inscritos oculta (`hiddenSubscriberCount`)
 * viram `crmCompetitorProfileNotFound` — não há métrica confiável a mostrar.
 */
export async function fetchYoutubePublicProfile(
  accessToken: string,
  handle: string,
): Promise<Result<DiscoveredProfile>> {
  const trimmed = handle.trim()
  const forHandle = trimmed.startsWith('@') ? trimmed : `@${trimmed}`
  const params = new URLSearchParams({ part: 'snippet,statistics', forHandle })
  const result = await getJson<{
    items?: {
      snippet?: {
        title?: string
        description?: string
        thumbnails?: {
          high?: { url?: string }
          default?: { url?: string }
        }
      }
      statistics?: {
        subscriberCount?: string
        videoCount?: string
        hiddenSubscriberCount?: boolean
      }
    }[]
  }>(
    `https://www.googleapis.com/youtube/v3/channels?${params.toString()}`,
    accessToken,
  )
  if (!result.ok) return result

  const channel = result.value.items?.[0]
  if (!channel || channel.statistics?.hiddenSubscriberCount) {
    return err(crmCompetitorProfileNotFound())
  }

  return ok({
    externalName: channel.snippet?.title ?? null,
    avatarUrl:
      channel.snippet?.thumbnails?.high?.url ??
      channel.snippet?.thumbnails?.default?.url ??
      null,
    bio: truncateBio(channel.snippet?.description),
    followersCount: toInt(channel.statistics?.subscriberCount),
    postsCount:
      channel.statistics?.videoCount != null
        ? toInt(channel.statistics.videoCount)
        : null,
  })
}
