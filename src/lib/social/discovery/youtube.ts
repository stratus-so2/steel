import { crmCompetitorProfileNotFound } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { getJson } from '../providers/http'
import type { DiscoveredPost, DiscoveredProfile, OwnMetrics } from './types'

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
    profileUrl: `https://www.youtube.com/${forHandle}`,
  })
}

const YT = 'https://www.googleapis.com/youtube/v3'

/** Videos kept per collection run (one page of `playlistItems.list`). */
const POSTS_PAGE_SIZE = 50

/** The API does not flag Shorts; up to this duration a video counts as one. */
const SHORT_MAX_SECONDS = 60

/** ISO 8601 duration (`PT1H2M3S`) in seconds; `null` when unparseable. */
export function parseIsoDurationSeconds(
  duration: string | undefined,
): number | null {
  if (!duration) return null
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
    duration,
  )
  if (!match) return null
  const [, d, h, m, sec] = match.map((v) => Number(v ?? 0))
  return d * 86_400 + h * 3600 + m * 60 + sec
}

type YoutubeVideo = {
  id?: string
  snippet?: { title?: string; description?: string; publishedAt?: string }
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string }
  contentDetails?: { duration?: string }
}

export function toYoutubePosts(videos: YoutubeVideo[]): DiscoveredPost[] {
  const posts: DiscoveredPost[] = []
  for (const video of videos) {
    if (!video.id || !video.snippet?.publishedAt) continue
    const publishedAt = new Date(video.snippet.publishedAt)
    if (Number.isNaN(publishedAt.getTime())) continue
    const seconds = parseIsoDurationSeconds(video.contentDetails?.duration)
    const caption = [video.snippet.title, video.snippet.description]
      .filter(Boolean)
      .join('\n\n')
    const stats = video.statistics
    posts.push({
      externalId: video.id,
      format:
        seconds !== null && seconds <= SHORT_MAX_SECONDS ? 'SHORT' : 'VIDEO',
      caption: caption ? truncateBio(caption) : null,
      permalink: `https://www.youtube.com/watch?v=${video.id}`,
      likeCount: stats?.likeCount != null ? toInt(stats.likeCount) : null,
      commentsCount:
        stats?.commentCount != null ? toInt(stats.commentCount) : null,
      viewCount: stats?.viewCount != null ? toInt(stats.viewCount) : null,
      publishedAt,
    })
  }
  return posts
}

/**
 * Latest uploads of a channel — the competitor's (`forHandle`) or the
 * connected one (`mine`). Goes through the uploads playlist instead of
 * `search.list`: three calls of 1 quota unit each, against 100 for a search.
 */
export async function fetchYoutubeChannelPosts(
  accessToken: string,
  channel: { handle: string } | { mine: true },
): Promise<Result<DiscoveredPost[]>> {
  const channelParams = new URLSearchParams({ part: 'contentDetails' })
  if ('mine' in channel) {
    channelParams.set('mine', 'true')
  } else {
    const trimmed = channel.handle.trim()
    channelParams.set(
      'forHandle',
      trimmed.startsWith('@') ? trimmed : `@${trimmed}`,
    )
  }
  const channelResult = await getJson<{
    items?: { contentDetails?: { relatedPlaylists?: { uploads?: string } } }[]
  }>(`${YT}/channels?${channelParams.toString()}`, accessToken)
  if (!channelResult.ok) return channelResult

  const uploads =
    channelResult.value.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
  if (!uploads) return err(crmCompetitorProfileNotFound())

  const playlistParams = new URLSearchParams({
    part: 'contentDetails',
    playlistId: uploads,
    maxResults: String(POSTS_PAGE_SIZE),
  })
  const playlist = await getJson<{
    items?: { contentDetails?: { videoId?: string } }[]
  }>(`${YT}/playlistItems?${playlistParams.toString()}`, accessToken)
  if (!playlist.ok) return playlist

  const ids = (playlist.value.items ?? [])
    .map((item) => item.contentDetails?.videoId)
    .filter((id): id is string => Boolean(id))
  if (ids.length === 0) return ok([])

  const videoParams = new URLSearchParams({
    part: 'snippet,statistics,contentDetails',
    id: ids.join(','),
    maxResults: String(POSTS_PAGE_SIZE),
  })
  const videos = await getJson<{ items?: YoutubeVideo[] }>(
    `${YT}/videos?${videoParams.toString()}`,
    accessToken,
  )
  if (!videos.ok) return videos
  return ok(toYoutubePosts(videos.value.items ?? []))
}
