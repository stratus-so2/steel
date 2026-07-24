import { useMutation, useQuery } from '@tanstack/react-query'
import type {
  CrmLinkedinOverview,
  CrmLinkedinPublishResult,
} from '@/src/schemas/crm-social-linkedin.schema'
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
  return ['crm-social-linkedin-overview', workspaceId] as const
}

function shouldRetry(failureCount: number, error: unknown) {
  return !isCrmSocialReconnectError(error) && failureCount < 2
}

export function useCrmLinkedinOverview(workspaceId: string) {
  return useQuery<CrmLinkedinOverview, CrmSocialApiError>({
    queryKey: overviewKey(workspaceId),
    queryFn: () =>
      fetchCrmSocial<CrmLinkedinOverview>(
        `/api/workspaces/${workspaceId}/crm/social/linkedin/overview`,
        undefined,
        'Erro ao buscar o perfil do LinkedIn',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
    retry: shouldRetry,
  })
}

export function usePublishCrmLinkedinPost(workspaceId: string) {
  return useMutation({
    mutationFn: (form: FormData) =>
      fetchCrmSocial<CrmLinkedinPublishResult>(
        `/api/workspaces/${workspaceId}/crm/social/linkedin/publish`,
        { method: 'POST', body: form },
        'Falha ao publicar no LinkedIn',
      ),
  })
}
