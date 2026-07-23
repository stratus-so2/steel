import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CrmPipelineDTO,
  CrmPipelineStageDTO,
  CrmStageCategoryDTO,
} from '@/types/crm-pipeline'
import { apiFetch, apiSend } from './_fetch'

function pipelinesKey(workspaceId: string) {
  return ['crm-pipelines', workspaceId] as const
}

function stagesKey(workspaceId: string, pipelineId: string) {
  return ['crm-pipeline-stages', workspaceId, pipelineId] as const
}

export function useCrmPipelines(workspaceId: string) {
  return useQuery({
    queryKey: pipelinesKey(workspaceId),
    queryFn: () =>
      apiFetch<CrmPipelineDTO[]>(
        `/api/workspaces/${workspaceId}/crm/pipelines`,
        undefined,
        'Erro ao buscar pipelines',
      ),
    enabled: !!workspaceId,
    staleTime: 2 * 60 * 1000,
  })
}

export function useCreateCrmPipeline(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { name: string; isDefault?: boolean }) =>
      apiFetch<CrmPipelineDTO>(
        `/api/workspaces/${workspaceId}/crm/pipelines`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao criar pipeline',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pipelinesKey(workspaceId) })
    },
  })
}

export function useDeleteCrmPipeline(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (pipelineId: string) =>
      apiSend(
        `/api/workspaces/${workspaceId}/crm/pipelines/${pipelineId}`,
        { method: 'DELETE' },
        'Erro ao remover pipeline',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pipelinesKey(workspaceId) })
    },
  })
}

export function useCrmPipelineStages(workspaceId: string, pipelineId: string) {
  return useQuery({
    queryKey: stagesKey(workspaceId, pipelineId),
    queryFn: () =>
      apiFetch<CrmPipelineStageDTO[]>(
        `/api/workspaces/${workspaceId}/crm/pipelines/${pipelineId}/stages`,
        undefined,
        'Erro ao buscar etapas',
      ),
    enabled: !!workspaceId && !!pipelineId,
    staleTime: 2 * 60 * 1000,
  })
}

export function useCreateCrmPipelineStage(
  workspaceId: string,
  pipelineId: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      name: string
      probability?: number
      category?: CrmStageCategoryDTO
    }) =>
      apiFetch<CrmPipelineStageDTO>(
        `/api/workspaces/${workspaceId}/crm/pipelines/${pipelineId}/stages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao criar etapa',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: stagesKey(workspaceId, pipelineId),
      })
    },
  })
}

export function useDeleteCrmPipelineStage(
  workspaceId: string,
  pipelineId: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (stageId: string) =>
      apiSend(
        `/api/workspaces/${workspaceId}/crm/pipelines/${pipelineId}/stages/${stageId}`,
        { method: 'DELETE' },
        'Erro ao remover etapa',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: stagesKey(workspaceId, pipelineId),
      })
    },
  })
}
