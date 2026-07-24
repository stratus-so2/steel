import { crmSocialOauthFailed, crmSocialScopeMissing } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { getJson } from '@/src/lib/social/providers/http'
import type {
  CrmSocialYoutubeInsightsDTO,
  CrmSocialYoutubeInsightsPointDTO,
  CrmSocialYoutubeInsightsRange,
  CrmSocialYoutubeOverviewDTO,
  CrmSocialYoutubePrivacy,
  CrmSocialYoutubePublishVideoInput,
  CrmSocialYoutubePublishVideoResultDTO,
  CrmSocialYoutubeVideosDTO,
} from '@/src/schemas/crm-social-youtube.schema'
import { YOUTUBE_INSIGHTS_RANGE_DAYS } from '@/src/schemas/crm-social-youtube.schema'
import { assertMember } from './authz'
import { getFreshAccessToken } from './crm-social-token'

const DATA_API = 'https://www.googleapis.com/youtube/v3'
const ANALYTICS_API = 'https://youtubeanalytics.googleapis.com/v2'
const UPLOAD_API =
  'https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=resumable'

/** Escopos exigidos por capacidade — usados para detectar conexões antigas. */
const REQUIRED_SCOPES = {
  read: 'youtube.readonly',
  analytics: 'yt-analytics.readonly',
  upload: 'youtube.upload',
} as const

function hasScope(scope: string | null, needle: string): boolean {
  return (scope ?? '').includes(needle)
}

/** Data UTC `YYYY-MM-DD` deslocada por `days` (negativo = no passado). */
function isoDate(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000)
  return d.toISOString().slice(0, 10)
}

function toInt(value: unknown): number {
  const n =
    typeof value === 'string' ? Number.parseInt(value, 10) : Number(value)
  return Number.isFinite(n) ? n : 0
}

async function logFailure(label: string, response: Response): Promise<void> {
  const body = await response.text().catch(() => '')
  console.error(
    `[youtube] ${label} falhou`,
    response.status,
    body.slice(0, 500),
  )
}

type YoutubeChannelsResponse = {
  items?: {
    id: string
    snippet?: {
      title?: string
      description?: string
      customUrl?: string
      thumbnails?: { medium?: { url?: string }; default?: { url?: string } }
    }
    statistics?: {
      subscriberCount?: string
      viewCount?: string
      videoCount?: string
    }
  }[]
}

async function fetchChannelOverview(
  accessToken: string,
): Promise<Result<CrmSocialYoutubeOverviewDTO>> {
  const result = await getJson<YoutubeChannelsResponse>(
    `${DATA_API}/channels?part=snippet,statistics&mine=true`,
    accessToken,
  )
  if (!result.ok) return result

  const channel = result.value.items?.[0]
  if (!channel) return err(crmSocialOauthFailed())

  const snippet = channel.snippet ?? {}
  const stats = channel.statistics ?? {}
  return ok({
    channelId: channel.id,
    title: snippet.title ?? 'Canal',
    description: snippet.description ?? null,
    customUrl: snippet.customUrl ?? null,
    thumbnailUrl:
      snippet.thumbnails?.medium?.url ??
      snippet.thumbnails?.default?.url ??
      null,
    subscriberCount: toInt(stats.subscriberCount),
    viewCount: toInt(stats.viewCount),
    videoCount: toInt(stats.videoCount),
  })
}

/** Requer a YouTube Analytics API habilitada no projeto Google Cloud (separada da Data API). */
async function fetchInsights(
  accessToken: string,
  args: {
    range: CrmSocialYoutubeInsightsRange
    startDate: string
    endDate: string
  },
): Promise<Result<CrmSocialYoutubeInsightsDTO>> {
  const params = new URLSearchParams({
    ids: 'channel==MINE',
    startDate: args.startDate,
    endDate: args.endDate,
    metrics: 'views,estimatedMinutesWatched,subscribersGained',
    dimensions: 'day',
    sort: 'day',
  })

  const result = await getJson<{
    rows?: [string, number, number, number][]
  }>(`${ANALYTICS_API}/reports?${params.toString()}`, accessToken)
  if (!result.ok) return result

  const series: CrmSocialYoutubeInsightsPointDTO[] = (
    result.value.rows ?? []
  ).map((row) => ({
    date: row[0],
    views: toInt(row[1]),
    estimatedMinutesWatched: toInt(row[2]),
    subscribersGained: toInt(row[3]),
  }))

  const totals = series.reduce(
    (acc, p) => ({
      views: acc.views + p.views,
      estimatedMinutesWatched:
        acc.estimatedMinutesWatched + p.estimatedMinutesWatched,
      subscribersGained: acc.subscribersGained + p.subscribersGained,
    }),
    { views: 0, estimatedMinutesWatched: 0, subscribersGained: 0 },
  )

  return ok({
    range: args.range,
    startDate: args.startDate,
    endDate: args.endDate,
    totals,
    series,
  })
}

/**
 * Upload resumable de vídeo (2 passos): abre a sessão com os metadados e
 * recebe uma `Location`; depois envia os bytes do arquivo nessa URL.
 */
async function uploadVideo(
  accessToken: string,
  args: {
    file: { bytes: ArrayBuffer; contentType: string }
    title: string
    description: string
    tags: string[]
    privacyStatus: CrmSocialYoutubePrivacy
  },
): Promise<Result<CrmSocialYoutubePublishVideoResultDTO>> {
  const metadata = {
    snippet: {
      title: args.title,
      description: args.description,
      tags: args.tags,
    },
    status: { privacyStatus: args.privacyStatus },
  }

  try {
    const init = await fetch(UPLOAD_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': args.file.contentType,
        'X-Upload-Content-Length': String(args.file.bytes.byteLength),
      },
      body: JSON.stringify(metadata),
    })
    if (!init.ok) {
      await logFailure('upload/init', init)
      return err(crmSocialOauthFailed())
    }
    const uploadUrl = init.headers.get('location')
    if (!uploadUrl) {
      console.error('[youtube] upload/init sem Location')
      return err(crmSocialOauthFailed())
    }

    const upload = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': args.file.contentType },
      body: args.file.bytes,
    })
    if (!upload.ok) {
      await logFailure('upload/bytes', upload)
      return err(crmSocialOauthFailed())
    }
    const json = (await upload.json()) as {
      id?: string
      snippet?: { title?: string }
      status?: { privacyStatus?: CrmSocialYoutubePrivacy }
    }
    if (!json.id) {
      console.error('[youtube] upload sem id de vídeo')
      return err(crmSocialOauthFailed())
    }

    return ok({
      videoId: json.id,
      url: `https://www.youtube.com/watch?v=${json.id}`,
      title: json.snippet?.title ?? args.title,
      privacyStatus: json.status?.privacyStatus ?? args.privacyStatus,
    })
  } catch (error) {
    console.error('[youtube] upload erro de rede', error)
    return err(crmSocialOauthFailed())
  }
}

/** Vídeos recentes via playlist de uploads (contentDetails → playlistItems → videos). */
async function fetchRecentVideos(
  accessToken: string,
): Promise<Result<CrmSocialYoutubeVideosDTO>> {
  const chRes = await getJson<{
    items?: { contentDetails?: { relatedPlaylists?: { uploads?: string } } }[]
  }>(`${DATA_API}/channels?part=contentDetails&mine=true`, accessToken)
  if (!chRes.ok) return chRes

  const uploadsPlaylistId =
    chRes.value.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
  if (!uploadsPlaylistId) {
    console.error('[youtube] playlist de uploads não encontrada')
    return err(crmSocialOauthFailed())
  }

  const plParams = new URLSearchParams({
    part: 'snippet,contentDetails',
    playlistId: uploadsPlaylistId,
    maxResults: '20',
  })
  const plRes = await getJson<{
    items?: {
      snippet?: {
        title?: string
        publishedAt?: string
        thumbnails?: { medium?: { url?: string }; default?: { url?: string } }
      }
      contentDetails?: { videoId?: string }
    }[]
  }>(`${DATA_API}/playlistItems?${plParams.toString()}`, accessToken)
  if (!plRes.ok) return plRes

  const baseVideos = (plRes.value.items ?? [])
    .map((item) => {
      const videoId = item.contentDetails?.videoId
      if (!videoId) return null
      return {
        videoId,
        title: item.snippet?.title ?? '',
        thumbnailUrl:
          item.snippet?.thumbnails?.medium?.url ??
          item.snippet?.thumbnails?.default?.url ??
          null,
        publishedAt: item.snippet?.publishedAt ?? '',
        url: `https://www.youtube.com/watch?v=${videoId}`,
      }
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)

  const statsMap = new Map<
    string,
    {
      viewCount: number
      likeCount: number
      commentCount: number
      duration: string | null
    }
  >()
  if (baseVideos.length > 0) {
    const statsParams = new URLSearchParams({
      part: 'statistics,contentDetails',
      id: baseVideos.map((v) => v.videoId).join(','),
    })
    const statsRes = await getJson<{
      items?: {
        id?: string
        statistics?: {
          viewCount?: string
          likeCount?: string
          commentCount?: string
        }
        contentDetails?: { duration?: string }
      }[]
    }>(`${DATA_API}/videos?${statsParams.toString()}`, accessToken)
    if (statsRes.ok) {
      for (const item of statsRes.value.items ?? []) {
        if (item.id) {
          statsMap.set(item.id, {
            viewCount: toInt(item.statistics?.viewCount),
            likeCount: toInt(item.statistics?.likeCount),
            commentCount: toInt(item.statistics?.commentCount),
            duration: item.contentDetails?.duration ?? null,
          })
        }
      }
    }
  }

  const videos = baseVideos.map((v) => {
    const stats = statsMap.get(v.videoId)
    return {
      ...v,
      viewCount: stats?.viewCount ?? 0,
      likeCount: stats?.likeCount ?? 0,
      commentCount: stats?.commentCount ?? 0,
      duration: stats?.duration ?? null,
    }
  })

  return ok({ videos })
}

/** Visão da conta: identidade do canal + estatísticas agregadas (Data API). */
export async function getOverview(
  actorId: string,
  workspaceId: string,
): Promise<Result<CrmSocialYoutubeOverviewDTO>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership

  const fresh = await getFreshAccessToken(workspaceId, 'YOUTUBE')
  if (!fresh.ok) return fresh
  if (!hasScope(fresh.value.connection.scope, REQUIRED_SCOPES.read)) {
    return err(crmSocialScopeMissing())
  }
  return fetchChannelOverview(fresh.value.accessToken)
}

/** Analytics (resumo + série diária) para a janela pedida. */
export async function getInsights(
  actorId: string,
  workspaceId: string,
  range: CrmSocialYoutubeInsightsRange,
): Promise<Result<CrmSocialYoutubeInsightsDTO>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership

  const fresh = await getFreshAccessToken(workspaceId, 'YOUTUBE')
  if (!fresh.ok) return fresh
  if (!hasScope(fresh.value.connection.scope, REQUIRED_SCOPES.analytics)) {
    return err(crmSocialScopeMissing())
  }
  // Analytics tem ~2-3 dias de atraso; pedimos até ontem para evitar buracos.
  return fetchInsights(fresh.value.accessToken, {
    range,
    startDate: isoDate(-YOUTUBE_INSIGHTS_RANGE_DAYS[range]),
    endDate: isoDate(-1),
  })
}

/** Vídeos recentes do canal (playlist de uploads). */
export async function getRecentVideos(
  actorId: string,
  workspaceId: string,
): Promise<Result<CrmSocialYoutubeVideosDTO>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership

  const fresh = await getFreshAccessToken(workspaceId, 'YOUTUBE')
  if (!fresh.ok) return fresh
  if (!hasScope(fresh.value.connection.scope, REQUIRED_SCOPES.read)) {
    return err(crmSocialScopeMissing())
  }
  return fetchRecentVideos(fresh.value.accessToken)
}

/** Publica (faz upload de) um vídeo no canal conectado. */
export async function publishVideo(
  actorId: string,
  workspaceId: string,
  input: CrmSocialYoutubePublishVideoInput,
  file: { bytes: ArrayBuffer; contentType: string },
): Promise<Result<CrmSocialYoutubePublishVideoResultDTO>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership

  const fresh = await getFreshAccessToken(workspaceId, 'YOUTUBE')
  if (!fresh.ok) return fresh
  if (!hasScope(fresh.value.connection.scope, REQUIRED_SCOPES.upload)) {
    return err(crmSocialScopeMissing())
  }

  return uploadVideo(fresh.value.accessToken, {
    file,
    title: input.title,
    description: input.description,
    tags: input.tags,
    privacyStatus: input.privacyStatus,
  })
}
