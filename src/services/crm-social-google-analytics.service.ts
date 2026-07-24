import {
  crmSocialConnectionNotFound,
  crmSocialScopeMissing,
} from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { getJson, postJson } from '@/src/lib/social/providers/http'
import {
  type CrmSocialGoogleAnalyticsInsightsDTO,
  type CrmSocialGoogleAnalyticsInsightsPointDTO,
  type CrmSocialGoogleAnalyticsInsightsRange,
  type CrmSocialGoogleAnalyticsOverviewDTO,
  GOOGLE_ANALYTICS_INSIGHTS_RANGE_DAYS,
} from '@/src/schemas/crm-social-google-analytics.schema'
import { assertMember } from './authz'
import { getFreshAccessToken } from './crm-social-token'

const DATA_API = 'https://analyticsdata.googleapis.com/v1beta'
const ADMIN_API = 'https://analyticsadmin.googleapis.com/v1beta'

const REQUIRED_SCOPES = {
  read: 'analytics.readonly',
} as const

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

/**
 * `externalAccountId` armazena o `properties/<id>` escolhido no connect. Se
 * ficou "unknown" (usuário sem propriedades GA4 acessíveis), tratamos como
 * conexão inválida — só reconectar resolve.
 */
function resolvePropertyId(externalAccountId: string): string | null {
  return externalAccountId && externalAccountId !== 'unknown'
    ? externalAccountId
    : null
}

type RunReportResponse = {
  rows?: {
    dimensionValues?: { value?: string }[]
    metricValues?: { value?: string }[]
  }[]
  totals?: { metricValues?: { value?: string }[] }[]
}

async function runReport(
  accessToken: string,
  propertyId: string,
  body: object,
): Promise<Result<RunReportResponse>> {
  return postJson<RunReportResponse>(
    `${DATA_API}/${propertyId}:runReport`,
    accessToken,
    body,
  )
}

async function fetchPropertyIdentity(
  accessToken: string,
  propertyId: string,
): Promise<Result<{ propertyName: string; accountName: string | null }>> {
  const result = await getJson<{ displayName?: string; account?: string }>(
    `${ADMIN_API}/${propertyId}`,
    accessToken,
  )
  if (!result.ok) return result

  // Busca o display name da conta-mãe (se houver) — opcional, só para exibição.
  let accountName: string | null = null
  if (result.value.account) {
    const accountResult = await getJson<{ displayName?: string }>(
      `${ADMIN_API}/${result.value.account}`,
      accessToken,
    )
    if (accountResult.ok) accountName = accountResult.value.displayName ?? null
  }

  return ok({
    propertyName: result.value.displayName ?? 'Propriedade',
    accountName,
  })
}

async function fetchOverview(
  accessToken: string,
  propertyId: string,
): Promise<Result<CrmSocialGoogleAnalyticsOverviewDTO>> {
  const identity = await fetchPropertyIdentity(accessToken, propertyId)
  if (!identity.ok) return identity

  const report = await runReport(accessToken, propertyId, {
    dateRanges: [{ startDate: isoDate(-28), endDate: isoDate(-1) }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'screenPageViews' },
      { name: 'eventCount' },
    ],
  })
  if (!report.ok) return report

  const totalsRow = report.value.totals?.[0]?.metricValues ?? []
  return ok({
    propertyId,
    propertyName: identity.value.propertyName,
    accountName: identity.value.accountName,
    totals: {
      activeUsers: toInt(totalsRow[0]?.value),
      sessions: toInt(totalsRow[1]?.value),
      screenPageViews: toInt(totalsRow[2]?.value),
      eventCount: toInt(totalsRow[3]?.value),
    },
  })
}

async function fetchInsights(
  accessToken: string,
  propertyId: string,
  args: {
    range: CrmSocialGoogleAnalyticsInsightsRange
    startDate: string
    endDate: string
  },
): Promise<Result<CrmSocialGoogleAnalyticsInsightsDTO>> {
  const report = await runReport(accessToken, propertyId, {
    dateRanges: [{ startDate: args.startDate, endDate: args.endDate }],
    dimensions: [{ name: 'date' }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'screenPageViews' },
      { name: 'eventCount' },
    ],
    orderBys: [{ dimension: { dimensionName: 'date' } }],
  })
  if (!report.ok) return report

  const series: CrmSocialGoogleAnalyticsInsightsPointDTO[] = (
    report.value.rows ?? []
  ).map((row) => {
    const raw = row.dimensionValues?.[0]?.value ?? '' // "YYYYMMDD"
    const date =
      raw.length === 8
        ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
        : raw
    const m = row.metricValues ?? []
    return {
      date,
      activeUsers: toInt(m[0]?.value),
      sessions: toInt(m[1]?.value),
      screenPageViews: toInt(m[2]?.value),
    }
  })

  const totalsRow = report.value.totals?.[0]?.metricValues ?? []
  return ok({
    range: args.range,
    startDate: args.startDate,
    endDate: args.endDate,
    totals: {
      activeUsers: toInt(totalsRow[0]?.value),
      sessions: toInt(totalsRow[1]?.value),
      screenPageViews: toInt(totalsRow[2]?.value),
      eventCount: toInt(totalsRow[3]?.value),
    },
    series,
  })
}

/** Visão da propriedade GA4: identidade + totais da janela padrão (28d). */
export async function getOverview(
  actorId: string,
  workspaceId: string,
): Promise<Result<CrmSocialGoogleAnalyticsOverviewDTO>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership

  const fresh = await getFreshAccessToken(workspaceId, 'GOOGLE_ANALYTICS')
  if (!fresh.ok) return fresh
  if (!hasScope(fresh.value.connection.scope, REQUIRED_SCOPES.read)) {
    return err(crmSocialScopeMissing())
  }
  const propertyId = resolvePropertyId(fresh.value.connection.externalAccountId)
  if (!propertyId) return err(crmSocialConnectionNotFound())

  return fetchOverview(fresh.value.accessToken, propertyId)
}

/** Analytics (resumo + série diária) para a janela pedida. */
export async function getInsights(
  actorId: string,
  workspaceId: string,
  range: CrmSocialGoogleAnalyticsInsightsRange,
): Promise<Result<CrmSocialGoogleAnalyticsInsightsDTO>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership

  const fresh = await getFreshAccessToken(workspaceId, 'GOOGLE_ANALYTICS')
  if (!fresh.ok) return fresh
  if (!hasScope(fresh.value.connection.scope, REQUIRED_SCOPES.read)) {
    return err(crmSocialScopeMissing())
  }
  const propertyId = resolvePropertyId(fresh.value.connection.externalAccountId)
  if (!propertyId) return err(crmSocialConnectionNotFound())

  return fetchInsights(fresh.value.accessToken, propertyId, {
    range,
    startDate: isoDate(-GOOGLE_ANALYTICS_INSIGHTS_RANGE_DAYS[range]),
    endDate: isoDate(-1),
  })
}
