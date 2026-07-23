import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CrmScheduledPostDTO,
  CrmSocialConnectionDTO,
  CrmSocialPlatformDTO,
} from '@/types/crm-social'
import { apiFetch, apiSend } from './_fetch'

function socialConnectionsKey(workspaceId: string) {
  return ['crm-social-connections', workspaceId] as const
}

function scheduledPostsKey(workspaceId: string) {
  return ['crm-scheduled-posts', workspaceId] as const
}

export function useCrmSocialConnections(workspaceId: string) {
  return useQuery({
    queryKey: socialConnectionsKey(workspaceId),
    queryFn: () =>
      apiFetch<CrmSocialConnectionDTO[]>(
        `/api/workspaces/${workspaceId}/crm/social-connections`,
        undefined,
        'Erro ao buscar conexões sociais',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
  })
}

export function useCreateCrmSocialConnection(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      platform: CrmSocialPlatformDTO
      externalAccountId: string
      accountName?: string
    }) =>
      apiFetch<CrmSocialConnectionDTO>(
        `/api/workspaces/${workspaceId}/crm/social-connections`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao criar conexão social',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: socialConnectionsKey(workspaceId),
      })
    },
  })
}

export function useDeleteCrmSocialConnection(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (connectionId: string) =>
      apiSend(
        `/api/workspaces/${workspaceId}/crm/social-connections/${connectionId}`,
        { method: 'DELETE' },
        'Erro ao remover conexão social',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: socialConnectionsKey(workspaceId),
      })
    },
  })
}

export function useCrmScheduledPosts(workspaceId: string) {
  return useQuery({
    queryKey: scheduledPostsKey(workspaceId),
    queryFn: () =>
      apiFetch<CrmScheduledPostDTO[]>(
        `/api/workspaces/${workspaceId}/crm/scheduled-posts`,
        undefined,
        'Erro ao buscar posts agendados',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
  })
}

export function useCreateCrmScheduledPost(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      content: string
      title?: string
      scheduledFor?: string
      platforms: CrmSocialPlatformDTO[]
    }) =>
      apiFetch<CrmScheduledPostDTO>(
        `/api/workspaces/${workspaceId}/crm/scheduled-posts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao criar post agendado',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: scheduledPostsKey(workspaceId),
      })
    },
  })
}

export function useDeleteCrmScheduledPost(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (postId: string) =>
      apiSend(
        `/api/workspaces/${workspaceId}/crm/scheduled-posts/${postId}`,
        { method: 'DELETE' },
        'Erro ao remover post agendado',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: scheduledPostsKey(workspaceId),
      })
    },
  })
}

export function usePublishCrmScheduledPost(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (postId: string) =>
      apiFetch<CrmScheduledPostDTO>(
        `/api/workspaces/${workspaceId}/crm/scheduled-posts/${postId}/publish`,
        { method: 'POST' },
        'Erro ao publicar post',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: scheduledPostsKey(workspaceId),
      })
    },
  })
}
