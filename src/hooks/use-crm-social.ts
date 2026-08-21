import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CrmScheduledPostDTO,
  CrmSocialConnectionDTO,
  CrmSocialPlatformDTO,
} from '@/types/crm-social'
import { apiFetch, apiSend } from './_fetch'

function socialConnectionsKey(workspaceId: string, platform?: string) {
  return ['crm-social-connections', workspaceId, platform ?? ''] as const
}

function scheduledPostsKey(workspaceId: string) {
  return ['crm-scheduled-posts', workspaceId] as const
}

export function useCrmSocialConnections(
  workspaceId: string,
  platform?: CrmSocialPlatformDTO,
) {
  return useQuery({
    queryKey: socialConnectionsKey(workspaceId, platform),
    queryFn: async () => {
      const all = await apiFetch<CrmSocialConnectionDTO[]>(
        `/api/workspaces/${workspaceId}/crm/social-connections`,
        undefined,
        'Erro ao buscar conexões sociais',
      )
      return platform ? all.filter((c) => c.platform === platform) : all
    },
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
  })
}

export function useSetCrmSocialConnectionPrimary(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (connectionId: string) =>
      apiFetch<CrmSocialConnectionDTO>(
        `/api/workspaces/${workspaceId}/crm/social-connections/${connectionId}/primary`,
        { method: 'PATCH' },
        'Erro ao definir conexão padrão',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['crm-social-connections', workspaceId],
      })
    },
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

export type CreateCrmScheduledPostInput = {
  content: string
  title?: string
  mode: 'now' | 'schedule'
  scheduledFor?: string
  platforms: CrmSocialPlatformDTO[]
  options?: Record<string, unknown>
  media?: File[]
}

export function useCreateCrmScheduledPost(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateCrmScheduledPostInput) => {
      const form = new FormData()
      form.set('content', data.content)
      if (data.title) form.set('title', data.title)
      form.set('mode', data.mode)
      if (data.scheduledFor) form.set('scheduledFor', data.scheduledFor)
      for (const platform of data.platforms) form.append('platforms', platform)
      if (data.options) form.set('options', JSON.stringify(data.options))
      for (const file of data.media ?? []) form.append('media', file)

      return apiFetch<CrmScheduledPostDTO>(
        `/api/workspaces/${workspaceId}/crm/scheduled-posts`,
        { method: 'POST', body: form },
        'Erro ao criar post agendado',
      )
    },
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

export function useCancelCrmScheduledPost(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (postId: string) =>
      apiFetch<CrmScheduledPostDTO>(
        `/api/workspaces/${workspaceId}/crm/scheduled-posts/${postId}/cancel`,
        { method: 'POST' },
        'Erro ao cancelar post',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: scheduledPostsKey(workspaceId),
      })
    },
  })
}

export function useRescheduleCrmScheduledPost(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      postId,
      scheduledFor,
    }: {
      postId: string
      scheduledFor: string
    }) =>
      apiFetch<CrmScheduledPostDTO>(
        `/api/workspaces/${workspaceId}/crm/scheduled-posts/${postId}/reschedule`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scheduledFor }),
        },
        'Erro ao reagendar post',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: scheduledPostsKey(workspaceId),
      })
    },
  })
}
