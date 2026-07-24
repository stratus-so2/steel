import { GOOGLE_ADS_DEVELOPER_TOKEN } from '@/lib/env/server'
import {
  crmSocialConnectionNotFound,
  crmSocialOauthFailed,
  crmSocialScopeMissing,
} from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  type CrmSocialGoogleAdsInsightsDTO,
  type CrmSocialGoogleAdsInsightsPointDTO,
  type CrmSocialGoogleAdsInsightsRange,
  type CrmSocialGoogleAdsOverviewDTO,
  GOOGLE_ADS_INSIGHTS_RANGE_DAYS,
} from '@/src/schemas/crm-social-google-ads.schema'
import { assertMember } from './authz'
import { getFreshAccessToken } from './crm-social-token'

const BASE = 'https://googleads.googleapis.com/v23'
const REQUIRED_SCOPE = 'adwords'

function hasScope(scope: string | null, needle: string): boolean {
  return (scope ?? '').includes(needle)
}

/** Data UTC `YYYY-MM-DD` deslocada por `days` (negativo = no passado). */
function isoDate(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
}

function toInt(value: unknown): number {
  const n =
    typeof value === 'string' ? Number.parseInt(value, 10) : Number(value)
  return Number.isFinite(n) ? n : 0
}

function toFloat(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

async function logFailure(label: string, response: Response): Promise<void> {
  const body = await response.text().catch(() => '')
  console.error(
    `[google-ads] ${label} falhou`,
    response.status,
    body.slice(0, 500),
  )
}

/**
 * `externalAccountId` guarda "customerId" (conta anunciante direta) ou
 * "managerId|subAccountId" (sob uma Manager Account) — ver
 * `src/lib/social/providers/google-ads.ts`.
 */
function parseCustomerId(raw: string): {
  customerId: string
  loginCustomerId?: string
} {
  const sep = raw.indexOf('|')
  if (sep !== -1) {
    return {
      customerId: raw.slice(sep + 1),
      loginCustomerId: raw.slice(0, sep),
    }
  }
  return { customerId: raw }
}

function resolveCustomerId(externalAccountId: string): string | null {
  if (!externalAccountId || externalAccountId === 'unknown') return null
  // "managerId|" sem subId = conta gerente sem sub-contas acessíveis.
  const sep = externalAccountId.indexOf('|')
  if (sep !== -1 && !externalAccountId.slice(sep + 1)) return null
  return externalAccountId
}

type SearchResponse = {
  results?: {
    customer?: {
      id?: string
      descriptiveName?: string
      currencyCode?: string
    }
    campaign?: { id?: string; name?: string; status?: string }
    metrics?: {
      impressions?: string
      clicks?: string
      costMicros?: string
      conversions?: string
      ctr?: string
    }
    segments?: { date?: string }
  }[]
}

/** POST GAQL. Aceita customerId simples ou "managerId|subId" (login-customer-id). */
async function gaqlSearch(
  rawCustomerId: string,
  accessToken: string,
  query: string,
): Promise<Result<SearchResponse>> {
  const { customerId, loginCustomerId } = parseCustomerId(rawCustomerId)

  let response: Response
  try {
    response = await fetch(`${BASE}/customers/${customerId}/googleAds:search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': GOOGLE_ADS_DEVELOPER_TOKEN ?? '',
        'Content-Type': 'application/json',
        ...(loginCustomerId && { 'login-customer-id': loginCustomerId }),
      },
      body: JSON.stringify({ query }),
    })
  } catch (error) {
    console.error('[google-ads] search erro de rede', error)
    return err(crmSocialOauthFailed())
  }

  if (!response.ok) {
    await logFailure('search', response)
    return err(crmSocialOauthFailed())
  }

  return ok((await response.json()) as SearchResponse)
}

/** Visão geral da conta: totais dos últimos 30d + contagem de campanhas ativas. */
async function fetchOverview(
  accessToken: string,
  customerId: string,
): Promise<Result<CrmSocialGoogleAdsOverviewDTO>> {
  const startDate = isoDate(-30)
  const endDate = isoDate(-1)

  const [totalsRes, nameRes] = await Promise.all([
    gaqlSearch(
      customerId,
      accessToken,
      `SELECT
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr
      FROM customer
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'`,
    ),
    gaqlSearch(
      customerId,
      accessToken,
      `SELECT
        customer.id,
        customer.descriptive_name,
        customer.currency_code
      FROM customer LIMIT 1`,
    ),
  ])

  if (!totalsRes.ok) return totalsRes
  if (!nameRes.ok) return nameRes

  const m = totalsRes.value.results?.[0]?.metrics
  const customer = nameRes.value.results?.[0]?.customer

  const campaignsRes = await gaqlSearch(
    customerId,
    accessToken,
    `SELECT campaign.id FROM campaign WHERE campaign.status = 'ENABLED'`,
  )
  const activeCampaigns = campaignsRes.ok
    ? (campaignsRes.value.results?.length ?? 0)
    : 0

  return ok({
    customerId,
    customerName: customer?.descriptiveName ?? null,
    currency: customer?.currencyCode ?? 'BRL',
    totals: {
      impressions: toInt(m?.impressions),
      clicks: toInt(m?.clicks),
      costMicros: toFloat(m?.costMicros),
      conversions: toFloat(m?.conversions),
      ctr: toFloat(m?.ctr),
    },
    activeCampaigns,
  })
}

/** Série diária de métricas de campanhas para o período pedido. */
async function fetchInsights(
  accessToken: string,
  customerId: string,
  range: CrmSocialGoogleAdsInsightsRange,
): Promise<Result<CrmSocialGoogleAdsInsightsDTO>> {
  const days = GOOGLE_ADS_INSIGHTS_RANGE_DAYS[range]
  const startDate = isoDate(-days)
  const endDate = isoDate(-1)

  const result = await gaqlSearch(
    customerId,
    accessToken,
    `SELECT
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    ORDER BY segments.date ASC`,
  )
  if (!result.ok) return result

  // Agrega por data (múltiplas campanhas no mesmo dia somam).
  const byDate = new Map<string, CrmSocialGoogleAdsInsightsPointDTO>()
  for (const row of result.value.results ?? []) {
    const date = row.segments?.date ?? ''
    if (!date) continue
    const prev = byDate.get(date) ?? {
      date,
      impressions: 0,
      clicks: 0,
      costMicros: 0,
      conversions: 0,
    }
    byDate.set(date, {
      date,
      impressions: prev.impressions + toInt(row.metrics?.impressions),
      clicks: prev.clicks + toInt(row.metrics?.clicks),
      costMicros: prev.costMicros + toFloat(row.metrics?.costMicros),
      conversions: prev.conversions + toFloat(row.metrics?.conversions),
    })
  }

  const series = Array.from(byDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  )

  const totals = series.reduce(
    (acc, p) => ({
      impressions: acc.impressions + p.impressions,
      clicks: acc.clicks + p.clicks,
      costMicros: acc.costMicros + p.costMicros,
      conversions: acc.conversions + p.conversions,
    }),
    { impressions: 0, clicks: 0, costMicros: 0, conversions: 0 },
  )

  return ok({ range, startDate, endDate, totals, series })
}

export async function getOverview(
  actorId: string,
  workspaceId: string,
): Promise<Result<CrmSocialGoogleAdsOverviewDTO>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership

  const fresh = await getFreshAccessToken(workspaceId, 'GOOGLE_ADS')
  if (!fresh.ok) return fresh
  if (!hasScope(fresh.value.connection.scope, REQUIRED_SCOPE)) {
    return err(crmSocialScopeMissing())
  }
  const customerId = resolveCustomerId(fresh.value.connection.externalAccountId)
  if (!customerId) return err(crmSocialConnectionNotFound())

  return fetchOverview(fresh.value.accessToken, customerId)
}

export async function getInsights(
  actorId: string,
  workspaceId: string,
  range: CrmSocialGoogleAdsInsightsRange,
): Promise<Result<CrmSocialGoogleAdsInsightsDTO>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership

  const fresh = await getFreshAccessToken(workspaceId, 'GOOGLE_ADS')
  if (!fresh.ok) return fresh
  if (!hasScope(fresh.value.connection.scope, REQUIRED_SCOPE)) {
    return err(crmSocialScopeMissing())
  }
  const customerId = resolveCustomerId(fresh.value.connection.externalAccountId)
  if (!customerId) return err(crmSocialConnectionNotFound())

  return fetchInsights(fresh.value.accessToken, customerId, range)
}
