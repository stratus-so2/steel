import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CrmLandingPageDTO } from '@/types/crm-landing-page'
import { apiFetch, apiSend } from './_fetch'

function landingPagesKey(workspaceId: string) {
  return ['crm-landing-pages', workspaceId] as const
}

export function useCrmLandingPages(workspaceId: string) {
  return useQuery({
    queryKey: landingPagesKey(workspaceId),
    queryFn: () =>
      apiFetch<CrmLandingPageDTO[]>(
        `/api/workspaces/${workspaceId}/crm/landing-pages`,
        undefined,
        'Erro ao buscar landing pages',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
  })
}

export function useCreateCrmLandingPage(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { title: string; html?: string }) =>
      apiFetch<CrmLandingPageDTO>(
        `/api/workspaces/${workspaceId}/crm/landing-pages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao criar landing page',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: landingPagesKey(workspaceId),
      })
    },
  })
}

export function useUpdateCrmLandingPage(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      pageId,
      data,
    }: {
      pageId: string
      data: { title?: string; html?: string }
    }) =>
      apiFetch<CrmLandingPageDTO>(
        `/api/workspaces/${workspaceId}/crm/landing-pages/${pageId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao atualizar landing page',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: landingPagesKey(workspaceId),
      })
    },
  })
}

export function useDeleteCrmLandingPage(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (pageId: string) =>
      apiSend(
        `/api/workspaces/${workspaceId}/crm/landing-pages/${pageId}`,
        { method: 'DELETE' },
        'Erro ao remover landing page',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: landingPagesKey(workspaceId),
      })
    },
  })
}

export function useSetCrmLandingPagePublished(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      pageId,
      published,
    }: {
      pageId: string
      published: boolean
    }) =>
      apiFetch<CrmLandingPageDTO>(
        `/api/workspaces/${workspaceId}/crm/landing-pages/${pageId}/publish`,
        { method: published ? 'POST' : 'DELETE' },
        'Erro ao atualizar publicação da landing page',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: landingPagesKey(workspaceId),
      })
    },
  })
}
