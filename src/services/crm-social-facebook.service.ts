import { crmSocialOauthFailed, crmSocialScopeMissing } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  getJson,
  postForm,
  postMultipart,
} from '@/src/lib/social/providers/http'
import {
  CRM_FB_INSIGHTS_RANGE_DAYS,
  type CrmFacebookInsights,
  type CrmFacebookInsightsPoint,
  type CrmFacebookInsightsRange,
  type CrmFacebookPageOverview,
  type CrmFacebookPosts,
  type CrmPublishFacebookPostInput,
  type CrmPublishFacebookPostResult,
} from '@/src/schemas/crm-social-facebook.schema'
import { assertMember } from './authz'
import { getFreshAccessToken } from './crm-social-token'

/** Graph API — mesma versão usada no provider OAuth. */
const GRAPH = 'https://graph.facebook.com/v21.0'

/** Escopos exigidos por capacidade — detecta conexões antigas (sem reconsentir). */
const REQUIRED_SCOPES = {
  read: 'pages_read_engagement',
  insights: 'read_insights',
  publish: 'pages_manage_posts',
} as const

/**
 * Métricas diárias de Página → campo do DTO. A Meta vem descontinuando
 * métricas de Página em ondas, então cada uma é buscada isoladamente (ver
 * `fetchInsights`): uma métrica morta apenas não contribui, em vez de
 * derrubar a chamada inteira.
 */
const INSIGHT_METRICS: {
  metric: string
  key: keyof Omit<CrmFacebookInsightsPoint, 'date'>
}[] = [
  { metric: 'page_impressions_unique', key: 'impressions' },
  { metric: 'page_post_engagements', key: 'engagements' },
  { metric: 'page_daily_follows', key: 'fanAdds' },
]

/** Data UTC `YYYY-MM-DD` deslocada por `days` (negativo = no passado). */
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

async function fetchPageOverview(
  pageToken: string,
  pageId: string,
): Promise<Result<CrmFacebookPageOverview>> {
  const params = new URLSearchParams({
    fields: 'id,name,about,link,fan_count,followers_count,picture.type(large)',
  })
  const result = await getJson<{
    id: string
    name?: string
    about?: string
    link?: string
    fan_count?: number
    followers_count?: number
    picture?: { data?: { url?: string } }
  }>(`${GRAPH}/${pageId}?${params.toString()}`, pageToken)
  if (!result.ok) return result

  const page = result.value
  return ok({
    pageId: page.id,
    name: page.name ?? 'Página',
    about: page.about ?? null,
    link: page.link ?? null,
    pictureUrl: page.picture?.data?.url ?? null,
    fanCount: toInt(page.fan_count),
    followersCount: toInt(page.followers_count),
  })
}

/**
 * Série diária de insights da Página. O Graph devolve um array por métrica,
 * cada um com valores diários (`{ value, end_time }`); reorganizamos por dia.
 */
async function fetchInsights(
  pageToken: string,
  pageId: string,
  args: { range: CrmFacebookInsightsRange; startDate: string; endDate: string },
): Promise<Result<CrmFacebookInsights>> {
  const byDate = new Map<string, CrmFacebookInsightsPoint>()
  const pointFor = (date: string): CrmFacebookInsightsPoint => {
    const existing = byDate.get(date)
    if (existing) return existing
    const fresh = { date, impressions: 0, engagements: 0, fanAdds: 0 }
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
    }>(`${GRAPH}/${pageId}/insights?${params.toString()}`, pageToken)
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
      engagements: acc.engagements + p.engagements,
      fanAdds: acc.fanAdds + p.fanAdds,
    }),
    { impressions: 0, engagements: 0, fanAdds: 0 },
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
 * Publica na Página. Com imagem → `/photos` (a imagem vira o post, com a
 * mensagem como legenda); sem imagem → `/feed` (mensagem + link opcional).
 */
async function publishToFacebook(
  pageToken: string,
  pageId: string,
  args: {
    message: string
    link: string | null
    image: { bytes: ArrayBuffer; contentType: string } | null
  },
): Promise<Result<CrmPublishFacebookPostResult>> {
  if (args.image) {
    const form = new FormData()
    form.set('access_token', pageToken)
    if (args.message) form.set('message', args.message)
    form.set(
      'source',
      new Blob([args.image.bytes], { type: args.image.contentType }),
      'upload',
    )
    const result = await postMultipart<{ id?: string; post_id?: string }>(
      `${GRAPH}/${pageId}/photos`,
      form,
    )
    if (!result.ok) return result
    const postId = result.value.post_id ?? result.value.id
    if (!postId) return err(crmSocialOauthFailed())
    return ok({ postId, url: `https://www.facebook.com/${postId}` })
  }

  const body: Record<string, string> = {
    access_token: pageToken,
    message: args.message,
  }
  if (args.link) body.link = args.link
  const result = await postForm<{ id?: string }>(
    `${GRAPH}/${pageId}/feed`,
    body,
  )
  if (!result.ok) return result
  if (!result.value.id) return err(crmSocialOauthFailed())
  return ok({
    postId: result.value.id,
    url: `https://www.facebook.com/${result.value.id}`,
  })
}

/** Posts recentes da Página (feed público). */
async function fetchRecentPosts(
  pageToken: string,
  pageId: string,
): Promise<Result<CrmFacebookPosts>> {
  const params = new URLSearchParams({
    fields: 'id,message,story,full_picture,permalink_url,created_time',
    limit: '20',
  })
  const result = await getJson<{
    data?: {
      id?: string
      message?: string
      story?: string
      full_picture?: string
      permalink_url?: string
      created_time?: string
    }[]
  }>(`${GRAPH}/${pageId}/posts?${params.toString()}`, pageToken)
  if (!result.ok) return result

  const posts = (result.value.data ?? []).map((item) => ({
    id: item.id ?? '',
    message: item.message ?? null,
    story: item.story ?? null,
    fullPicture: item.full_picture ?? null,
    permalinkUrl: item.permalink_url ?? null,
    createdTime: item.created_time ?? '',
  }))

  return ok({ posts })
}

/** Visão da Página: identidade + contagens. */
export async function getOverview(
  actorId: string,
  workspaceId: string,
): Promise<Result<CrmFacebookPageOverview>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership

  const fresh = await getFreshAccessToken(workspaceId, 'FACEBOOK')
  if (!fresh.ok) return fresh
  if (!hasScope(fresh.value.connection.scope, REQUIRED_SCOPES.read)) {
    return err(crmSocialScopeMissing())
  }
  return fetchPageOverview(
    fresh.value.accessToken,
    fresh.value.connection.externalAccountId,
  )
}

/** Insights (resumo + série diária) para a janela pedida. */
export async function getInsights(
  actorId: string,
  workspaceId: string,
  range: CrmFacebookInsightsRange,
): Promise<Result<CrmFacebookInsights>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership

  const fresh = await getFreshAccessToken(workspaceId, 'FACEBOOK')
  if (!fresh.ok) return fresh
  if (!hasScope(fresh.value.connection.scope, REQUIRED_SCOPES.insights)) {
    return err(crmSocialScopeMissing())
  }
  return fetchInsights(
    fresh.value.accessToken,
    fresh.value.connection.externalAccountId,
    {
      range,
      startDate: isoDate(-CRM_FB_INSIGHTS_RANGE_DAYS[range]),
      endDate: isoDate(0),
    },
  )
}

/** Posts recentes da Página (feed público). */
export async function getRecentPosts(
  actorId: string,
  workspaceId: string,
): Promise<Result<CrmFacebookPosts>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership

  const fresh = await getFreshAccessToken(workspaceId, 'FACEBOOK')
  if (!fresh.ok) return fresh
  if (!hasScope(fresh.value.connection.scope, REQUIRED_SCOPES.read)) {
    return err(crmSocialScopeMissing())
  }
  return fetchRecentPosts(
    fresh.value.accessToken,
    fresh.value.connection.externalAccountId,
  )
}

/** Publica um post (texto/link, ou imagem com legenda) na Página. */
export async function publishPost(
  actorId: string,
  workspaceId: string,
  input: CrmPublishFacebookPostInput,
  image: { bytes: ArrayBuffer; contentType: string } | null,
): Promise<Result<CrmPublishFacebookPostResult>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership

  const fresh = await getFreshAccessToken(workspaceId, 'FACEBOOK')
  if (!fresh.ok) return fresh
  if (!hasScope(fresh.value.connection.scope, REQUIRED_SCOPES.publish)) {
    return err(crmSocialScopeMissing())
  }
  return publishToFacebook(
    fresh.value.accessToken,
    fresh.value.connection.externalAccountId,
    {
      message: input.message,
      link: input.link,
      image,
    },
  )
}
