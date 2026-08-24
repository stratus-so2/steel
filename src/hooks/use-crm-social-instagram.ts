import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CrmDeleteInstagramMediaResult,
  CrmInstagramInsights,
  CrmInstagramInsightsRange,
  CrmInstagramMediaList,
  CrmInstagramProfileOverview,
  CrmInstagramStoriesList,
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

function overviewKey(workspaceId: string, connectionId?: string) {
  return [
    'crm-social-instagram-overview',
    workspaceId,
    connectionId ?? '',
  ] as const
}

function insightsKey(
  workspaceId: string,
  range: CrmInstagramInsightsRange,
  connectionId?: string,
) {
  return [
    'crm-social-instagram-insights',
    workspaceId,
    range,
    connectionId ?? '',
  ] as const
}

function mediaKey(workspaceId: string, connectionId?: string) {
  return [
    'crm-social-instagram-media',
    workspaceId,
    connectionId ?? '',
  ] as const
}

function storiesKey(workspaceId: string, connectionId?: string) {
  return [
    'crm-social-instagram-stories',
    workspaceId,
    connectionId ?? '',
  ] as const
}

function engagementKey(workspaceId: string, connectionId?: string) {
  return [
    'crm-social-instagram-engagement',
    workspaceId,
    connectionId ?? '',
  ] as const
}

function withConnectionId(url: string, connectionId?: string) {
  if (!connectionId) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}connectionId=${encodeURIComponent(connectionId)}`
}

function shouldRetry(failureCount: number, error: unknown) {
  return !isCrmSocialReconnectError(error) && failureCount < 2
}

export function useCrmInstagramOverview(
  workspaceId: string,
  connectionId?: string,
) {
  return useQuery({
    queryKey: overviewKey(workspaceId, connectionId),
    queryFn: () =>
      fetchCrmSocial<CrmInstagramProfileOverview>(
        withConnectionId(
          `/api/workspaces/${workspaceId}/crm/social/instagram/overview`,
          connectionId,
        ),
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
  connectionId?: string,
) {
  return useQuery({
    queryKey: insightsKey(workspaceId, range, connectionId),
    queryFn: () =>
      fetchCrmSocial<CrmInstagramInsights>(
        withConnectionId(
          `/api/workspaces/${workspaceId}/crm/social/instagram/insights?range=${range}`,
          connectionId,
        ),
        undefined,
        'Erro ao buscar insights do Instagram',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
    retry: shouldRetry,
  })
}

export function useCrmInstagramMedia(
  workspaceId: string,
  connectionId?: string,
) {
  return useQuery({
    queryKey: mediaKey(workspaceId, connectionId),
    queryFn: () =>
      fetchCrmSocial<CrmInstagramMediaList>(
        withConnectionId(
          `/api/workspaces/${workspaceId}/crm/social/instagram/videos`,
          connectionId,
        ),
        undefined,
        'Erro ao buscar publicações do Instagram',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
    retry: shouldRetry,
  })
}

export function useCrmInstagramStories(
  workspaceId: string,
  connectionId?: string,
) {
  return useQuery({
    queryKey: storiesKey(workspaceId, connectionId),
    queryFn: () =>
      fetchCrmSocial<CrmInstagramStoriesList>(
        withConnectionId(
          `/api/workspaces/${workspaceId}/crm/social/instagram/stories`,
          connectionId,
        ),
        undefined,
        'Erro ao buscar stories do Instagram',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
    retry: shouldRetry,
  })
}

export function useCrmInstagramEngagement(
  workspaceId: string,
  connectionId?: string,
) {
  return useQuery({
    queryKey: engagementKey(workspaceId, connectionId),
    queryFn: () =>
      fetchCrmSocial<CrmInstagramWeeklyEngagement>(
        withConnectionId(
          `/api/workspaces/${workspaceId}/crm/social/instagram/engagement`,
          connectionId,
        ),
        undefined,
        'Erro ao buscar engajamento do Instagram',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
    retry: shouldRetry,
  })
}

export function usePublishCrmInstagramPost(
  workspaceId: string,
  connectionId?: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (form: FormData) =>
      fetchCrmSocial<CrmPublishInstagramPostResult>(
        `/api/workspaces/${workspaceId}/crm/social/instagram/publish`,
        { method: 'POST', body: form },
        'Falha ao publicar no Instagram',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: mediaKey(workspaceId, connectionId),
      })
      queryClient.invalidateQueries({
        queryKey: storiesKey(workspaceId, connectionId),
      })
      queryClient.invalidateQueries({
        queryKey: engagementKey(workspaceId, connectionId),
      })
    },
  })
}

export function useDeleteCrmInstagramMedia(
  workspaceId: string,
  connectionId?: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (mediaId: string) =>
      fetchCrmSocial<CrmDeleteInstagramMediaResult>(
        withConnectionId(
          `/api/workspaces/${workspaceId}/crm/social/instagram/posts/${mediaId}`,
          connectionId,
        ),
        { method: 'DELETE' },
        'Falha ao excluir a publicação',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: mediaKey(workspaceId, connectionId),
      })
      queryClient.invalidateQueries({
        queryKey: storiesKey(workspaceId, connectionId),
      })
      queryClient.invalidateQueries({
        queryKey: engagementKey(workspaceId, connectionId),
      })
    },
  })
}
