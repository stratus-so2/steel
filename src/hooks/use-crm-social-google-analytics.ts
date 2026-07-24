import { useQuery } from '@tanstack/react-query'
import type {
  CrmSocialGoogleAnalyticsInsightsDTO,
  CrmSocialGoogleAnalyticsInsightsRange,
  CrmSocialGoogleAnalyticsOverviewDTO,
} from '@/src/schemas/crm-social-google-analytics.schema'
import type { HttpResponse } from '@/types/http-response'

// Preserves `error.code` (e.g. CRM_SOCIAL_TOKEN_EXPIRED) so the UI can tell
// a "needs reconnect" failure apart from a generic one — apiFetch discards it.
export class CrmSocialApiError extends Error {
  code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'CrmSocialApiError'
    this.code = code
  }
}

async function fetchCrmSocial<T>(url: string, fallback: string): Promise<T> {
  const res = await fetch(url)
  const json: HttpResponse<T> = await res.json().catch(() => ({
    success: false,
    statusCode: res.status,
  }))
  if (!res.ok || !json.success || json.data === undefined) {
    throw new CrmSocialApiError(json.message ?? fallback, json.error?.code)
  }
  return json.data
}

function googleAnalyticsOverviewKey(workspaceId: string) {
  return ['crm-google-analytics-overview', workspaceId] as const
}

function googleAnalyticsInsightsKey(
  workspaceId: string,
  range: CrmSocialGoogleAnalyticsInsightsRange,
) {
  return ['crm-google-analytics-insights', workspaceId, range] as const
}

export function useCrmGoogleAnalyticsOverview(workspaceId: string) {
  return useQuery({
    queryKey: googleAnalyticsOverviewKey(workspaceId),
    queryFn: () =>
      fetchCrmSocial<CrmSocialGoogleAnalyticsOverviewDTO>(
        `/api/workspaces/${workspaceId}/crm/social/google_analytics/overview`,
        'Erro ao buscar propriedade do Google Analytics',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
    retry: false,
  })
}

export function useCrmGoogleAnalyticsInsights(
  workspaceId: string,
  range: CrmSocialGoogleAnalyticsInsightsRange,
) {
  return useQuery({
    queryKey: googleAnalyticsInsightsKey(workspaceId, range),
    queryFn: () =>
      fetchCrmSocial<CrmSocialGoogleAnalyticsInsightsDTO>(
        `/api/workspaces/${workspaceId}/crm/social/google_analytics/insights?range=${range}`,
        'Erro ao buscar insights do Google Analytics',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
    retry: false,
  })
}
