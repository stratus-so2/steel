import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CrmPublishTiktokVideoResult,
  CrmTiktokCreatorOverview,
  CrmTiktokVideos,
  CrmTiktokWeeklyEngagement,
} from '@/src/schemas/crm-social-tiktok.schema'
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

async function postCrmSocialForm<T>(
  url: string,
  form: FormData,
  fallback: string,
): Promise<T> {
  const res = await fetch(url, { method: 'POST', body: form })
  const json: HttpResponse<T> = await res.json().catch(() => ({
    success: false,
    statusCode: res.status,
  }))
  if (!res.ok || !json.success || json.data === undefined) {
    throw new CrmSocialApiError(json.message ?? fallback, json.error?.code)
  }
  return json.data
}

function tiktokOverviewKey(workspaceId: string) {
  return ['crm-tiktok-overview', workspaceId] as const
}

function tiktokVideosKey(workspaceId: string) {
  return ['crm-tiktok-videos', workspaceId] as const
}

function tiktokEngagementKey(workspaceId: string) {
  return ['crm-tiktok-engagement', workspaceId] as const
}

export function useCrmTiktokOverview(workspaceId: string) {
  return useQuery({
    queryKey: tiktokOverviewKey(workspaceId),
    queryFn: () =>
      fetchCrmSocial<CrmTiktokCreatorOverview>(
        `/api/workspaces/${workspaceId}/crm/social/tiktok/overview`,
        'Erro ao buscar conta do TikTok',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
    retry: false,
  })
}

export function useCrmTiktokVideos(workspaceId: string) {
  return useQuery({
    queryKey: tiktokVideosKey(workspaceId),
    queryFn: () =>
      fetchCrmSocial<CrmTiktokVideos>(
        `/api/workspaces/${workspaceId}/crm/social/tiktok/videos`,
        'Erro ao buscar vídeos do TikTok',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
    retry: false,
  })
}

export function useCrmTiktokEngagement(workspaceId: string) {
  return useQuery({
    queryKey: tiktokEngagementKey(workspaceId),
    queryFn: () =>
      fetchCrmSocial<CrmTiktokWeeklyEngagement>(
        `/api/workspaces/${workspaceId}/crm/social/tiktok/engagement`,
        'Erro ao buscar engajamento do TikTok',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
    retry: false,
  })
}

export function usePublishCrmTiktokVideo(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (form: FormData) =>
      postCrmSocialForm<CrmPublishTiktokVideoResult>(
        `/api/workspaces/${workspaceId}/crm/social/tiktok/publish`,
        form,
        'Erro ao publicar vídeo no TikTok',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: tiktokOverviewKey(workspaceId),
      })
      queryClient.invalidateQueries({ queryKey: tiktokVideosKey(workspaceId) })
      queryClient.invalidateQueries({
        queryKey: tiktokEngagementKey(workspaceId),
      })
    },
  })
}
