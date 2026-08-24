import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CrmSocialYoutubeInsightsDTO,
  CrmSocialYoutubeInsightsRange,
  CrmSocialYoutubeOverviewDTO,
  CrmSocialYoutubePublishVideoResultDTO,
  CrmSocialYoutubeVideosDTO,
} from '@/src/schemas/crm-social-youtube.schema'
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

async function deleteCrmSocial<T>(url: string, fallback: string): Promise<T> {
  const res = await fetch(url, { method: 'DELETE' })
  const json: HttpResponse<T> = await res.json().catch(() => ({
    success: false,
    statusCode: res.status,
  }))
  if (!res.ok || !json.success || json.data === undefined) {
    throw new CrmSocialApiError(json.message ?? fallback, json.error?.code)
  }
  return json.data
}

function youtubeOverviewKey(workspaceId: string) {
  return ['crm-youtube-overview', workspaceId] as const
}

function youtubeInsightsKey(
  workspaceId: string,
  range: CrmSocialYoutubeInsightsRange,
) {
  return ['crm-youtube-insights', workspaceId, range] as const
}

function youtubeVideosKey(workspaceId: string) {
  return ['crm-youtube-videos', workspaceId] as const
}

export function useCrmYoutubeOverview(workspaceId: string) {
  return useQuery({
    queryKey: youtubeOverviewKey(workspaceId),
    queryFn: () =>
      fetchCrmSocial<CrmSocialYoutubeOverviewDTO>(
        `/api/workspaces/${workspaceId}/crm/social/youtube/overview`,
        'Erro ao buscar canal do YouTube',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
    retry: false,
  })
}

export function useCrmYoutubeInsights(
  workspaceId: string,
  range: CrmSocialYoutubeInsightsRange,
) {
  return useQuery({
    queryKey: youtubeInsightsKey(workspaceId, range),
    queryFn: () =>
      fetchCrmSocial<CrmSocialYoutubeInsightsDTO>(
        `/api/workspaces/${workspaceId}/crm/social/youtube/insights?range=${range}`,
        'Erro ao buscar insights do YouTube',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
    retry: false,
  })
}

export function useCrmYoutubeVideos(workspaceId: string) {
  return useQuery({
    queryKey: youtubeVideosKey(workspaceId),
    queryFn: () =>
      fetchCrmSocial<CrmSocialYoutubeVideosDTO>(
        `/api/workspaces/${workspaceId}/crm/social/youtube/videos`,
        'Erro ao buscar vídeos do YouTube',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
    retry: false,
  })
}

export function usePublishCrmYoutubeVideo(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (form: FormData) =>
      postCrmSocialForm<CrmSocialYoutubePublishVideoResultDTO>(
        `/api/workspaces/${workspaceId}/crm/social/youtube/publish`,
        form,
        'Erro ao publicar vídeo no YouTube',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: youtubeOverviewKey(workspaceId),
      })
      queryClient.invalidateQueries({ queryKey: youtubeVideosKey(workspaceId) })
      queryClient.invalidateQueries({
        queryKey: ['crm-youtube-insights', workspaceId],
      })
    },
  })
}

export function useDeleteCrmYoutubeVideo(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (videoId: string) =>
      deleteCrmSocial<{ deletedId: string }>(
        `/api/workspaces/${workspaceId}/crm/social/youtube/posts/${videoId}`,
        'Falha ao excluir o vídeo',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: youtubeOverviewKey(workspaceId),
      })
      queryClient.invalidateQueries({ queryKey: youtubeVideosKey(workspaceId) })
    },
  })
}
