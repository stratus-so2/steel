import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CrmWorkflowDefinitionDTO } from '@/src/schemas/crm-workflow.schema'
import type {
  CrmWorkflowDTO,
  CrmWorkflowRunDTO,
  CrmWorkflowTriggerTypeDTO,
} from '@/types/crm-workflow'
import { apiFetch, apiSend } from './_fetch'

function workflowsKey(workspaceId: string) {
  return ['crm-workflows', workspaceId] as const
}

function workflowRunsKey(workspaceId: string, workflowId: string) {
  return ['crm-workflow-runs', workspaceId, workflowId] as const
}

export function useCrmWorkflows(workspaceId: string) {
  return useQuery({
    queryKey: workflowsKey(workspaceId),
    queryFn: () =>
      apiFetch<CrmWorkflowDTO[]>(
        `/api/workspaces/${workspaceId}/crm/workflows`,
        undefined,
        'Erro ao buscar workflows',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
  })
}

export function useCreateCrmWorkflow(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      name: string
      description?: string
      triggerType: CrmWorkflowTriggerTypeDTO
      definition: CrmWorkflowDefinitionDTO
    }) =>
      apiFetch<CrmWorkflowDTO>(
        `/api/workspaces/${workspaceId}/crm/workflows`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao criar workflow',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowsKey(workspaceId) })
    },
  })
}

export function useDeleteCrmWorkflow(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (workflowId: string) =>
      apiSend(
        `/api/workspaces/${workspaceId}/crm/workflows/${workflowId}`,
        { method: 'DELETE' },
        'Erro ao remover workflow',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowsKey(workspaceId) })
    },
  })
}

export function useSetCrmWorkflowActive(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      workflowId,
      active,
    }: {
      workflowId: string
      active: boolean
    }) =>
      apiFetch<CrmWorkflowDTO>(
        `/api/workspaces/${workspaceId}/crm/workflows/${workflowId}/${active ? 'activate' : 'deactivate'}`,
        { method: 'POST' },
        'Erro ao atualizar status do workflow',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowsKey(workspaceId) })
    },
  })
}

export function useRunCrmWorkflow(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (workflowId: string) =>
      apiFetch<CrmWorkflowRunDTO>(
        `/api/workspaces/${workspaceId}/crm/workflows/${workflowId}/run`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
        'Erro ao executar workflow',
      ),
    onSuccess: (_data, workflowId) => {
      queryClient.invalidateQueries({ queryKey: workflowsKey(workspaceId) })
      queryClient.invalidateQueries({
        queryKey: workflowRunsKey(workspaceId, workflowId),
      })
    },
  })
}

export function useCrmWorkflowRuns(
  workspaceId: string,
  workflowId: string | null,
) {
  return useQuery({
    queryKey: workflowRunsKey(workspaceId, workflowId ?? ''),
    queryFn: () =>
      apiFetch<CrmWorkflowRunDTO[]>(
        `/api/workspaces/${workspaceId}/crm/workflows/${workflowId}/runs`,
        undefined,
        'Erro ao buscar execuções do workflow',
      ),
    enabled: !!workspaceId && !!workflowId,
    staleTime: 15 * 1000,
  })
}
