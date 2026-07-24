import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CrmInstagramInsights,
  CrmInstagramInsightsRange,
  CrmInstagramMediaList,
  CrmInstagramProfileOverview,
  CrmInstagramWeeklyEngagement,
  CrmPublishInstagramPostResult,
} from '@/src/schemas/crm-social-instagram.schema'
import type { ErrorResponse, SuccessResponse } from '@/types/http-response'

/** Erro de API com o `code` de domínio preservado (ex.: CRM_SOCIAL_IG_NOT_LINKED). */
export class CrmSocialApiError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'CrmSocialApiError'
    this.code = code
  }
}

/** Códigos de erro que significam "reconecte a conta" em vez de uma falha genérica. */
const RECONNECT_CODES = new Set([
  'CRM_SOCIAL_CONNECTION_NOT_FOUND',
  'CRM_SOCIAL_SCOPE_MISSING',
  'CRM_SOCIAL_TOKEN_EXPIRED',
  'CRM_SOCIAL_NOT_CONFIGURED',
  'CRM_SOCIAL_IG_NOT_LINKED',
])

export function isCrmSocialReconnectError(
  error: unknown,
): error is CrmSocialApiError {
  return error instanceof CrmSocialApiError && RECONNECT_CODES.has(error.code)
}

// apiFetch only surfaces `message`; social studios need `error.code` to tell
// a "reconnect the account" state apart from a generic failure.
async function fetchCrmSocial<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  fallbackError = 'Algo deu errado',
): Promise<T> {
  const res = await fetch(input, init)
  const json = (await res.json().catch(() => null)) as
    | SuccessResponse<T>
    | ErrorResponse
    | null

  if (!res.ok || !json?.success) {
    const code = json && !json.success ? json.error.code : 'UNKNOWN'
    throw new CrmSocialApiError(code, json?.message ?? fallbackError)
  }

  return json.data
}

function overviewKey(workspaceId: string) {
  return ['crm-social-instagram-overview', workspaceId] as const
}

function insightsKey(workspaceId: string, range: CrmInstagramInsightsRange) {
  return ['crm-social-instagram-insights', workspaceId, range] as const
}

function mediaKey(workspaceId: string) {
  return ['crm-social-instagram-media', workspaceId] as const
}

function engagementKey(workspaceId: string) {
  return ['crm-social-instagram-engagement', workspaceId] as const
}

function shouldRetry(failureCount: number, error: unknown) {
  return !isCrmSocialReconnectError(error) && failureCount < 2
}

export function useCrmInstagramOverview(workspaceId: string) {
  return useQuery({
    queryKey: overviewKey(workspaceId),
    queryFn: () =>
      fetchCrmSocial<CrmInstagramProfileOverview>(
        `/api/workspaces/${workspaceId}/crm/social/instagram/overview`,
        undefined,
        'Erro ao buscar o perfil do Instagram',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
    retry: shouldRetry,
  })
}

export function useCrmInstagramInsights(
  workspaceId: string,
  range: CrmInstagramInsightsRange,
) {
  return useQuery({
    queryKey: insightsKey(workspaceId, range),
    queryFn: () =>
      fetchCrmSocial<CrmInstagramInsights>(
        `/api/workspaces/${workspaceId}/crm/social/instagram/insights?range=${range}`,
        undefined,
        'Erro ao buscar insights do Instagram',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
    retry: shouldRetry,
  })
}

export function useCrmInstagramMedia(workspaceId: string) {
  return useQuery({
    queryKey: mediaKey(workspaceId),
    queryFn: () =>
      fetchCrmSocial<CrmInstagramMediaList>(
        `/api/workspaces/${workspaceId}/crm/social/instagram/videos`,
        undefined,
        'Erro ao buscar publicações do Instagram',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
    retry: shouldRetry,
  })
}

export function useCrmInstagramEngagement(workspaceId: string) {
  return useQuery({
    queryKey: engagementKey(workspaceId),
    queryFn: () =>
      fetchCrmSocial<CrmInstagramWeeklyEngagement>(
        `/api/workspaces/${workspaceId}/crm/social/instagram/engagement`,
        undefined,
        'Erro ao buscar engajamento do Instagram',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
    retry: shouldRetry,
  })
}

export function usePublishCrmInstagramPost(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (form: FormData) =>
      fetchCrmSocial<CrmPublishInstagramPostResult>(
        `/api/workspaces/${workspaceId}/crm/social/instagram/publish`,
        { method: 'POST', body: form },
        'Falha ao publicar no Instagram',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mediaKey(workspaceId) })
      queryClient.invalidateQueries({ queryKey: engagementKey(workspaceId) })
    },
  })
}
