import { useQuery } from '@tanstack/react-query'
import type {
  CrmSocialGoogleAdsInsightsDTO,
  CrmSocialGoogleAdsInsightsRange,
  CrmSocialGoogleAdsOverviewDTO,
} from '@/src/schemas/crm-social-google-ads.schema'
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

function googleAdsOverviewKey(workspaceId: string) {
  return ['crm-google-ads-overview', workspaceId] as const
}

function googleAdsInsightsKey(
  workspaceId: string,
  range: CrmSocialGoogleAdsInsightsRange,
) {
  return ['crm-google-ads-insights', workspaceId, range] as const
}

export function useCrmGoogleAdsOverview(workspaceId: string) {
  return useQuery({
    queryKey: googleAdsOverviewKey(workspaceId),
    queryFn: () =>
      fetchCrmSocial<CrmSocialGoogleAdsOverviewDTO>(
        `/api/workspaces/${workspaceId}/crm/social/google_ads/overview`,
        'Erro ao buscar conta do Google Ads',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
    retry: false,
  })
}

export function useCrmGoogleAdsInsights(
  workspaceId: string,
  range: CrmSocialGoogleAdsInsightsRange,
) {
  return useQuery({
    queryKey: googleAdsInsightsKey(workspaceId, range),
    queryFn: () =>
      fetchCrmSocial<CrmSocialGoogleAdsInsightsDTO>(
        `/api/workspaces/${workspaceId}/crm/social/google_ads/insights?range=${range}`,
        'Erro ao buscar insights do Google Ads',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
    retry: false,
  })
}
