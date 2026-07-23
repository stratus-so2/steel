import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CrmDocumentTypeDTO, CrmProposalDTO } from '@/types/crm-proposal'
import { apiFetch, apiSend } from './_fetch'

function proposalsKey(workspaceId: string) {
  return ['crm-proposals', workspaceId] as const
}

export function useCrmProposals(workspaceId: string) {
  return useQuery({
    queryKey: proposalsKey(workspaceId),
    queryFn: () =>
      apiFetch<CrmProposalDTO[]>(
        `/api/workspaces/${workspaceId}/crm/proposals`,
        undefined,
        'Erro ao buscar documentos',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
  })
}

export function useCreateCrmProposal(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      title: string
      content?: string
      type?: CrmDocumentTypeDTO
    }) =>
      apiFetch<CrmProposalDTO>(
        `/api/workspaces/${workspaceId}/crm/proposals`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao criar documento',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: proposalsKey(workspaceId) })
    },
  })
}

export function useUpdateCrmProposal(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      proposalId,
      data,
    }: {
      proposalId: string
      data: { title?: string; content?: string; type?: CrmDocumentTypeDTO }
    }) =>
      apiFetch<CrmProposalDTO>(
        `/api/workspaces/${workspaceId}/crm/proposals/${proposalId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao atualizar documento',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: proposalsKey(workspaceId) })
    },
  })
}

export function useDeleteCrmProposal(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (proposalId: string) =>
      apiSend(
        `/api/workspaces/${workspaceId}/crm/proposals/${proposalId}`,
        { method: 'DELETE' },
        'Erro ao remover documento',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: proposalsKey(workspaceId) })
    },
  })
}

export function useSetCrmProposalPublished(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      proposalId,
      published,
    }: {
      proposalId: string
      published: boolean
    }) =>
      apiFetch<CrmProposalDTO>(
        `/api/workspaces/${workspaceId}/crm/proposals/${proposalId}/publish`,
        { method: published ? 'POST' : 'DELETE' },
        'Erro ao atualizar publicação do documento',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: proposalsKey(workspaceId) })
    },
  })
}
