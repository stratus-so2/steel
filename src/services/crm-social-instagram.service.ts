import { BETTER_AUTH_URL } from '@/lib/env/server'
import { crmSocialOauthFailed, crmSocialScopeMissing } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { putBlob, removeBlob } from '@/src/lib/social/blob-store'
import { getJson, postForm } from '@/src/lib/social/providers/http'
import {
  CRM_IG_INSIGHTS_RANGE_DAYS,
  type CrmInstagramInsights,
  type CrmInstagramInsightsPoint,
  type CrmInstagramInsightsRange,
  type CrmInstagramMediaEngagement,
  type CrmInstagramMediaList,
  type CrmInstagramPostType,
  type CrmInstagramProfileOverview,
  type CrmInstagramWeeklyEngagement,
  type CrmPublishInstagramPostInput,
  type CrmPublishInstagramPostResult,
} from '@/src/schemas/crm-social-instagram.schema'
import { assertMember } from './authz'
import { getFreshAccessToken } from './crm-social-token'

/** Graph API (Meta) — mesma versão usada no provider OAuth. */
const GRAPH = 'https://graph.facebook.com/v21.0'

/** Escopos exigidos por capacidade — detecta conexões antigas (sem reconsentir). */
const REQUIRED_SCOPES = {
  read: 'instagram_basic',
  insights: 'instagram_manage_insights',
  publish: 'instagram_content_publish',
} as const

/**
 * Métricas diárias da conta IG → campo do DTO. A Meta descontinua métricas IG
 * em ondas, então cada uma é buscada isoladamente — uma morta apenas não
 * contribui, em vez de derrubar a chamada inteira.
 */
const INSIGHT_METRICS: {
  metric: string
  key: keyof Omit<CrmInstagramInsightsPoint, 'date'>
}[] = [
  { metric: 'impressions', key: 'impressions' },
  { metric: 'reach', key: 'reach' },
  { metric: 'profile_views', key: 'profileViews' },
]

function isoDate(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
}

function hasScope(scope: string | null, needle: string): boolean {
  return (scope ?? '').includes(needle)
}

function toInt(value: unknown): number {
  const n =
    typeof value === 'string' ? Number.parseInt(value, 10) : Number(value)
  return Number.isFinite(n) ? n : 0
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchProfile(
  pageToken: string,
  igAccountId: string,
): Promise<Result<CrmInstagramProfileOverview>> {
  const params = new URLSearchParams({
    fields:
      'id,username,name,biography,profile_picture_url,media_count,followers_count,follows_count',
  })
  const result = await getJson<{
    id: string
    username?: string
    name?: string
    biography?: string
    profile_picture_url?: string
    media_count?: number
    followers_count?: number
    follows_count?: number
  }>(`${GRAPH}/${igAccountId}?${params.toString()}`, pageToken)
  if (!result.ok) return result

  const p = result.value
  return ok({
    igAccountId: p.id,
    username: p.username ?? '',
    name: p.name ?? null,
    biography: p.biography ?? null,
    profilePictureUrl: p.profile_picture_url ?? null,
    mediaCount: toInt(p.media_count),
    followersCount: toInt(p.followers_count),
    followsCount: toInt(p.follows_count),
  })
}

/**
 * Série diária de insights da conta. O Graph devolve um array por métrica,
 * cada um com valores diários (`{ value, end_time }`); reorganizamos por dia.
 */
async function fetchInsights(
  pageToken: string,
  igAccountId: string,
  args: {
    range: CrmInstagramInsightsRange
    startDate: string
    endDate: string
  },
): Promise<Result<CrmInstagramInsights>> {
  const byDate = new Map<string, CrmInstagramInsightsPoint>()
  const pointFor = (date: string): CrmInstagramInsightsPoint => {
    const existing = byDate.get(date)
    if (existing) return existing
    const fresh = { date, impressions: 0, reach: 0, profileViews: 0 }
    byDate.set(date, fresh)
    return fresh
  }

  for (const { metric, key } of INSIGHT_METRICS) {
    const params = new URLSearchParams({
      metric,
      period: 'day',
      since: args.startDate,
      until: args.endDate,
    })
    const result = await getJson<{
      data?: { values?: { value?: number; end_time?: string }[] }[]
    }>(`${GRAPH}/${igAccountId}/insights?${params.toString()}`, pageToken)
    if (!result.ok) continue

    for (const m of result.value.data ?? []) {
      for (const point of m.values ?? []) {
        if (!point.end_time) continue
        pointFor(point.end_time.slice(0, 10))[key] = toInt(point.value)
      }
    }
  }

  const series = [...byDate.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  )
  const totals = series.reduce(
    (acc, p) => ({
      impressions: acc.impressions + p.impressions,
      reach: acc.reach + p.reach,
      profileViews: acc.profileViews + p.profileViews,
    }),
    { impressions: 0, reach: 0, profileViews: 0 },
  )

  return ok({
    range: args.range,
    startDate: args.startDate,
    endDate: args.endDate,
    totals,
    series,
  })
}

/** Mídias recentes do perfil (feed): imagens, vídeos e carrosséis. */
async function fetchRecentMedia(
  pageToken: string,
  igAccountId: string,
): Promise<Result<CrmInstagramMediaList>> {
  const params = new URLSearchParams({
    fields:
      'id,media_type,media_url,thumbnail_url,caption,timestamp,permalink,like_count,comments_count',
    limit: '20',
  })
  const result = await getJson<{
    data?: {
      id?: string
      media_type?: string
      media_url?: string
      thumbnail_url?: string
      caption?: string
      timestamp?: string
      permalink?: string
      like_count?: number
      comments_count?: number
    }[]
  }>(`${GRAPH}/${igAccountId}/media?${params.toString()}`, pageToken)
  if (!result.ok) return result

  const media = (result.value.data ?? []).map((item) => ({
    id: item.id ?? '',
    mediaType: (item.media_type ?? 'IMAGE') as
      | 'IMAGE'
      | 'VIDEO'
      | 'CAROUSEL_ALBUM',
    mediaUrl: item.media_url ?? null,
    thumbnailUrl: item.thumbnail_url ?? null,
    caption: item.caption ?? null,
    timestamp: item.timestamp ?? '',
    permalink: item.permalink ?? null,
    likeCount: toInt(item.like_count),
    commentsCount: toInt(item.comments_count),
  }))

  return ok({ media })
}

/**
 * `saved` de um post específico (métrica de insight por mídia). Nem todo tipo
 * de mídia suporta — falha vira `0` (best-effort), não bloqueia o restante do
 * cálculo de engajamento semanal.
 */
async function fetchMediaSaved(
  pageToken: string,
  mediaId: string,
): Promise<number> {
  const params = new URLSearchParams({ metric: 'saved' })
  const result = await getJson<{ data?: { values?: { value?: number }[] }[] }>(
    `${GRAPH}/${mediaId}/insights?${params.toString()}`,
    pageToken,
  )
  if (!result.ok) return 0
  return toInt(result.value.data?.[0]?.values?.[0]?.value)
}

/**
 * Mídias recentes publicadas desde `cutoffMs`, enriquecidas com `saved`
 * (insight por post, best-effort) + `engagementScore`. Base compartilhada por
 * `getWeeklyEngagement` (cutoff = 7d) e por rankings de engajamento diário.
 */
async function fetchEnrichedMediaSince(
  accessToken: string,
  igAccountId: string,
  cutoffMs: number,
): Promise<Result<CrmInstagramMediaEngagement[]>> {
  const mediaResult = await fetchRecentMedia(accessToken, igAccountId)
  if (!mediaResult.ok) return mediaResult

  const recent = mediaResult.value.media.filter((m) => {
    const t = new Date(m.timestamp).getTime()
    return Number.isFinite(t) && t >= cutoffMs
  })

  const withSaved = await Promise.all(
    recent.map(async (m) => {
      const saved = await fetchMediaSaved(accessToken, m.id)
      return {
        ...m,
        saved,
        engagementScore: m.likeCount + m.commentsCount + saved,
      }
    }),
  )
  return ok(withSaved)
}

/**
 * Containers de vídeo (REELS / STORIES com vídeo) são processados de forma
 * assíncrona pela Meta: o `/media_publish` só aceita o container quando o
 * `status_code` chega a `FINISHED`. Faz polling até finalizar, falhar ou
 * estourar o tempo. Containers de imagem ficam prontos na hora.
 */
async function waitForContainerReady(
  pageToken: string,
  containerId: string,
): Promise<Result<true>> {
  const MAX_ATTEMPTS = 50 // ~2,5 min (dentro do TTL do blob-store de 10 min)
  const INTERVAL_MS = 3000
  const params = new URLSearchParams({ fields: 'status_code' })

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const result = await getJson<{ status_code?: string }>(
      `${GRAPH}/${containerId}?${params.toString()}`,
      pageToken,
    )
    if (!result.ok) return result

    const status = result.value.status_code
    if (status === 'FINISHED') return ok(true)
    if (status === 'ERROR' || status === 'EXPIRED') {
      return err(crmSocialOauthFailed())
    }
    await sleep(INTERVAL_MS)
  }
  return err(crmSocialOauthFailed())
}

/**
 * Publica no Instagram conforme o `postType`. Fluxo em 2 passos: cria um
 * container (`/media`) e depois publica (`/media_publish` com `creation_id`).
 * A URL da mídia precisa ser HTTP pública acessível pela Meta — servida pelo
 * `blob-store` via `publishPost` abaixo.
 */
async function publishToInstagram(
  pageToken: string,
  igAccountId: string,
  args: {
    caption: string
    postType: CrmInstagramPostType
    imageUrl?: string | null
    videoUrl?: string | null
  },
): Promise<Result<CrmPublishInstagramPostResult>> {
  const containerBody: Record<string, string> = {}
  let isVideoContainer = false

  if (args.postType === 'REELS') {
    if (!args.videoUrl) return err(crmSocialOauthFailed())
    containerBody.media_type = 'REELS'
    containerBody.video_url = args.videoUrl
    containerBody.share_to_feed = 'true'
    if (args.caption) containerBody.caption = args.caption
    isVideoContainer = true
  } else if (args.postType === 'STORIES') {
    containerBody.media_type = 'STORIES'
    if (args.videoUrl) {
      containerBody.video_url = args.videoUrl
      isVideoContainer = true
    } else if (args.imageUrl) {
      containerBody.image_url = args.imageUrl
    } else {
      return err(crmSocialOauthFailed())
    }
  } else {
    if (!args.imageUrl) return err(crmSocialOauthFailed())
    containerBody.image_url = args.imageUrl
    if (args.caption) containerBody.caption = args.caption
  }

  const containerResult = await postForm<{ id?: string }>(
    `${GRAPH}/${igAccountId}/media`,
    { ...containerBody, access_token: pageToken },
  )
  if (!containerResult.ok) return containerResult
  const containerId = containerResult.value.id
  if (!containerId) return err(crmSocialOauthFailed())

  if (isVideoContainer) {
    const ready = await waitForContainerReady(pageToken, containerId)
    if (!ready.ok) return ready
  }

  const publishResult = await postForm<{ id?: string }>(
    `${GRAPH}/${igAccountId}/media_publish`,
    { creation_id: containerId, access_token: pageToken },
  )
  if (!publishResult.ok) return publishResult
  const postId = publishResult.value.id
  if (!postId) return err(crmSocialOauthFailed())

  // Permalink é best-effort — não bloqueia o sucesso da publicação.
  let permalink: string | null = null
  const permaParams = new URLSearchParams({ fields: 'permalink' })
  const permaResult = await getJson<{ permalink?: string }>(
    `${GRAPH}/${postId}?${permaParams.toString()}`,
    pageToken,
  )
  if (permaResult.ok) permalink = permaResult.value.permalink ?? null

  return ok({ postId, permalink })
}

/** Visão do perfil: identidade + contagens. */
export async function getOverview(
  actorId: string,
  workspaceId: string,
): Promise<Result<CrmInstagramProfileOverview>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership

  const fresh = await getFreshAccessToken(workspaceId, 'INSTAGRAM')
  if (!fresh.ok) return fresh
  if (!hasScope(fresh.value.connection.scope, REQUIRED_SCOPES.read)) {
    return err(crmSocialScopeMissing())
  }
  return fetchProfile(
    fresh.value.accessToken,
    fresh.value.connection.externalAccountId,
  )
}

/** Insights (resumo + série diária) para a janela pedida. */
export async function getInsights(
  actorId: string,
  workspaceId: string,
  range: CrmInstagramInsightsRange,
): Promise<Result<CrmInstagramInsights>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership

  const fresh = await getFreshAccessToken(workspaceId, 'INSTAGRAM')
  if (!fresh.ok) return fresh
  if (!hasScope(fresh.value.connection.scope, REQUIRED_SCOPES.insights)) {
    return err(crmSocialScopeMissing())
  }
  return fetchInsights(
    fresh.value.accessToken,
    fresh.value.connection.externalAccountId,
    {
      range,
      startDate: isoDate(-CRM_IG_INSIGHTS_RANGE_DAYS[range]),
      endDate: isoDate(0),
    },
  )
}

/** Mídias recentes do perfil (feed): imagens, vídeos e carrosséis. */
export async function getRecentMedia(
  actorId: string,
  workspaceId: string,
): Promise<Result<CrmInstagramMediaList>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership

  const fresh = await getFreshAccessToken(workspaceId, 'INSTAGRAM')
  if (!fresh.ok) return fresh
  if (!hasScope(fresh.value.connection.scope, REQUIRED_SCOPES.read)) {
    return err(crmSocialScopeMissing())
  }
  return fetchRecentMedia(
    fresh.value.accessToken,
    fresh.value.connection.externalAccountId,
  )
}

/**
 * Resumo semanal: views (impressões 7d), saves (soma do insight `saved` por
 * post publicado nos últimos 7 dias), visitas ao perfil (7d) e o top 5 de
 * posts recentes por engajamento (curtidas + comentários + saves).
 */
export async function getWeeklyEngagement(
  actorId: string,
  workspaceId: string,
): Promise<Result<CrmInstagramWeeklyEngagement>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership

  const fresh = await getFreshAccessToken(workspaceId, 'INSTAGRAM')
  if (!fresh.ok) return fresh
  if (!hasScope(fresh.value.connection.scope, REQUIRED_SCOPES.insights)) {
    return err(crmSocialScopeMissing())
  }

  const igAccountId = fresh.value.connection.externalAccountId
  const insights = await fetchInsights(fresh.value.accessToken, igAccountId, {
    range: '7d',
    startDate: isoDate(-CRM_IG_INSIGHTS_RANGE_DAYS['7d']),
    endDate: isoDate(0),
  })
  if (!insights.ok) return insights

  const cutoff = Date.now() - CRM_IG_INSIGHTS_RANGE_DAYS['7d'] * 86_400_000
  const enriched = await fetchEnrichedMediaSince(
    fresh.value.accessToken,
    igAccountId,
    cutoff,
  )
  if (!enriched.ok) return enriched

  const saves7d = enriched.value.reduce((sum, m) => sum + m.saved, 0)
  const top5 = [...enriched.value]
    .sort((a, b) => b.engagementScore - a.engagementScore)
    .slice(0, 5)

  return ok({
    views7d: insights.value.totals.impressions,
    saves7d,
    profileViews7d: insights.value.totals.profileViews,
    top5,
  })
}

/**
 * Publica no Instagram conforme o `postType` (feed, reels ou stories). O
 * Graph IG não aceita upload direto — exige uma URL pública. Hospedamos os
 * bytes no `blob-store`, geramos uma URL pública sob
 * `${BETTER_AUTH_URL}/api/social/blob/<token>` e a passamos ao Graph; após o
 * publish, o blob é removido.
 */
export async function publishPost(
  actorId: string,
  workspaceId: string,
  input: CrmPublishInstagramPostInput,
  media: { bytes: ArrayBuffer; contentType: string; kind: 'IMAGE' | 'VIDEO' },
): Promise<Result<CrmPublishInstagramPostResult>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership

  const fresh = await getFreshAccessToken(workspaceId, 'INSTAGRAM')
  if (!fresh.ok) return fresh
  if (!hasScope(fresh.value.connection.scope, REQUIRED_SCOPES.publish)) {
    return err(crmSocialScopeMissing())
  }

  const token = putBlob(media.bytes, media.contentType)
  const url = `${BETTER_AUTH_URL.replace(/\/$/, '')}/api/social/blob/${token}`
  try {
    return await publishToInstagram(
      fresh.value.accessToken,
      fresh.value.connection.externalAccountId,
      {
        caption: input.caption,
        postType: input.postType,
        imageUrl: media.kind === 'IMAGE' ? url : null,
        videoUrl: media.kind === 'VIDEO' ? url : null,
      },
    )
  } finally {
    removeBlob(token)
  }
}
