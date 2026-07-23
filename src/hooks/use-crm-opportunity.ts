import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CrmOpportunityDTO } from '@/types/crm-opportunity'
import { apiFetch, apiSend } from './_fetch'

function opportunitiesKey(workspaceId: string, pipelineId?: string) {
  return ['crm-opportunities', workspaceId, pipelineId] as const
}

export function useCrmOpportunities(workspaceId: string, pipelineId?: string) {
  return useQuery({
    queryKey: opportunitiesKey(workspaceId, pipelineId),
    queryFn: () =>
      apiFetch<CrmOpportunityDTO[]>(
        `/api/workspaces/${workspaceId}/crm/opportunities${
          pipelineId ? `?pipelineId=${pipelineId}` : ''
        }`,
        undefined,
        'Erro ao buscar oportunidades',
      ),
    enabled: !!workspaceId && !!pipelineId,
    staleTime: 60 * 1000,
  })
}

export function useCreateCrmOpportunity(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      name: string
      pipelineId: string
      stageId: string
      amount?: number
    }) =>
      apiFetch<CrmOpportunityDTO>(
        `/api/workspaces/${workspaceId}/crm/opportunities`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao criar oportunidade',
      ),
    onSuccess: (created) => {
      queryClient.invalidateQueries({
        queryKey: opportunitiesKey(workspaceId, created.pipelineId),
      })
    },
  })
}

export function useMoveCrmOpportunity(workspaceId: string, pipelineId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      opportunityId,
      stageId,
    }: {
      opportunityId: string
      stageId: string
    }) =>
      apiFetch<CrmOpportunityDTO>(
        `/api/workspaces/${workspaceId}/crm/opportunities/${opportunityId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stageId }),
        },
        'Erro ao mover oportunidade',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: opportunitiesKey(workspaceId, pipelineId),
      })
    },
  })
}

export function useDeleteCrmOpportunity(
  workspaceId: string,
  pipelineId: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (opportunityId: string) =>
      apiSend(
        `/api/workspaces/${workspaceId}/crm/opportunities/${opportunityId}`,
        { method: 'DELETE' },
        'Erro ao remover oportunidade',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: opportunitiesKey(workspaceId, pipelineId),
      })
    },
  })
}
