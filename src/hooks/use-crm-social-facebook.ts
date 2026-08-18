import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CrmFacebookInsights,
  CrmFacebookInsightsRange,
  CrmFacebookPageOverview,
  CrmFacebookPosts,
  CrmPublishFacebookPostResult,
} from '@/src/schemas/crm-social-facebook.schema'
import type { ErrorResponse, SuccessResponse } from '@/types/http-response'

/** Erro de API com o `code` de domínio preservado (ex.: CRM_SOCIAL_TOKEN_EXPIRED). */
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
  'CRM_SOCIAL_NO_PAGE',
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

function overviewKey(workspaceId: string, connectionId?: string) {
  return [
    'crm-social-facebook-overview',
    workspaceId,
    connectionId ?? '',
  ] as const
}

function insightsKey(
  workspaceId: string,
  range: CrmFacebookInsightsRange,
  connectionId?: string,
) {
  return [
    'crm-social-facebook-insights',
    workspaceId,
    range,
    connectionId ?? '',
  ] as const
}

function postsKey(workspaceId: string, connectionId?: string) {
  return ['crm-social-facebook-posts', workspaceId, connectionId ?? ''] as const
}

function withConnectionId(url: string, connectionId?: string) {
  if (!connectionId) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}connectionId=${encodeURIComponent(connectionId)}`
}

function shouldRetry(failureCount: number, error: unknown) {
  return !isCrmSocialReconnectError(error) && failureCount < 2
}

export function useCrmFacebookOverview(
  workspaceId: string,
  connectionId?: string,
) {
  return useQuery({
    queryKey: overviewKey(workspaceId, connectionId),
    queryFn: () =>
      fetchCrmSocial<CrmFacebookPageOverview>(
        withConnectionId(
          `/api/workspaces/${workspaceId}/crm/social/facebook/overview`,
          connectionId,
        ),
        undefined,
        'Erro ao buscar a Página do Facebook',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
    retry: shouldRetry,
  })
}

export function useCrmFacebookInsights(
  workspaceId: string,
  range: CrmFacebookInsightsRange,
  connectionId?: string,
) {
  return useQuery({
    queryKey: insightsKey(workspaceId, range, connectionId),
    queryFn: () =>
      fetchCrmSocial<CrmFacebookInsights>(
        withConnectionId(
          `/api/workspaces/${workspaceId}/crm/social/facebook/insights?range=${range}`,
          connectionId,
        ),
        undefined,
        'Erro ao buscar insights do Facebook',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
    retry: shouldRetry,
  })
}

export function useCrmFacebookPosts(
  workspaceId: string,
  connectionId?: string,
) {
  return useQuery({
    queryKey: postsKey(workspaceId, connectionId),
    queryFn: () =>
      fetchCrmSocial<CrmFacebookPosts>(
        withConnectionId(
          `/api/workspaces/${workspaceId}/crm/social/facebook/videos`,
          connectionId,
        ),
        undefined,
        'Erro ao buscar publicações do Facebook',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
    retry: shouldRetry,
  })
}

export function usePublishCrmFacebookPost(
  workspaceId: string,
  connectionId?: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (form: FormData) =>
      fetchCrmSocial<CrmPublishFacebookPostResult>(
        `/api/workspaces/${workspaceId}/crm/social/facebook/publish`,
        { method: 'POST', body: form },
        'Falha ao publicar no Facebook',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: postsKey(workspaceId, connectionId),
      })
    },
  })
}
