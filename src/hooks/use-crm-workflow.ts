import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CrmWorkflowDefinition,
  CrmWorkflowDTO,
  CrmWorkflowRunDTO,
  CrmWorkflowVersionDTO,
} from '@/src/schemas/crm-workflow.schema'
import { apiFetch, apiSend } from './_fetch'

function workflowsKey(workspaceId: string) {
  return ['crm-workflows', workspaceId] as const
}

function workflowKey(workspaceId: string, workflowId: string) {
  return ['crm-workflow', workspaceId, workflowId] as const
}

function workflowDraftKey(workspaceId: string, workflowId: string) {
  return ['crm-workflow-draft', workspaceId, workflowId] as const
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

export function useCrmWorkflow(workspaceId: string, workflowId: string | null) {
  return useQuery({
    queryKey: workflowKey(workspaceId, workflowId ?? ''),
    queryFn: () =>
      apiFetch<CrmWorkflowDTO>(
        `/api/workspaces/${workspaceId}/crm/workflows/${workflowId}`,
        undefined,
        'Workflow não encontrado.',
      ),
    enabled: !!workspaceId && !!workflowId,
  })
}

/** Draft editável (o que o canvas exibe/edita) — separado da versão ACTIVE. */
export function useCrmWorkflowDraft(
  workspaceId: string,
  workflowId: string | null,
) {
  return useQuery({
    queryKey: workflowDraftKey(workspaceId, workflowId ?? ''),
    queryFn: () =>
      apiFetch<CrmWorkflowVersionDTO>(
        `/api/workspaces/${workspaceId}/crm/workflows/${workflowId}/draft`,
        undefined,
        'Draft não encontrado.',
      ),
    enabled: !!workspaceId && !!workflowId,
  })
}

export function useCreateCrmWorkflow(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
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
    onSuccess: (_data, { workflowId }) => {
      queryClient.invalidateQueries({ queryKey: workflowsKey(workspaceId) })
      queryClient.invalidateQueries({
        queryKey: workflowKey(workspaceId, workflowId),
      })
      queryClient.invalidateQueries({
        queryKey: workflowDraftKey(workspaceId, workflowId),
      })
    },
  })
}

export function useDiscardCrmWorkflowDraft(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (workflowId: string) =>
      apiFetch<CrmWorkflowVersionDTO>(
        `/api/workspaces/${workspaceId}/crm/workflows/${workflowId}/discard`,
        { method: 'POST' },
        'Erro ao descartar alterações',
      ),
    onSuccess: (_data, workflowId) => {
      queryClient.invalidateQueries({
        queryKey: workflowDraftKey(workspaceId, workflowId),
      })
    },
  })
}

/** Autosave do editor: persiste o `definition` completo a cada alteração no canvas. */
export function useUpdateCrmWorkflowDraft(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      workflowId,
      definition,
    }: {
      workflowId: string
      definition: CrmWorkflowDefinition
    }) =>
      apiFetch<CrmWorkflowVersionDTO>(
        `/api/workspaces/${workspaceId}/crm/workflows/${workflowId}/draft`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ definition }),
        },
        'Erro ao salvar workflow',
      ),
    onSuccess: (_data, { workflowId }) => {
      queryClient.invalidateQueries({
        queryKey: workflowDraftKey(workspaceId, workflowId),
      })
    },
  })
}

export function useTriggerCrmWorkflow(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      workflowId,
      test = false,
      payload = {},
    }: {
      workflowId: string
      test?: boolean
      payload?: Record<string, unknown>
    }) =>
      apiFetch<CrmWorkflowRunDTO>(
        `/api/workspaces/${workspaceId}/crm/workflows/${workflowId}/trigger`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test, payload }),
        },
        'Erro ao executar workflow',
      ),
    onSuccess: (_data, { workflowId }) => {
      queryClient.invalidateQueries({ queryKey: workflowsKey(workspaceId) })
      queryClient.invalidateQueries({
        queryKey: workflowRunsKey(workspaceId, workflowId),
      })
    },
  })
}

export function useResumeCrmWorkflowRun(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      workflowId,
      runId,
      payload,
    }: {
      workflowId: string
      runId: string
      payload: Record<string, unknown>
    }) =>
      apiFetch<CrmWorkflowRunDTO>(
        `/api/workspaces/${workspaceId}/crm/workflows/${workflowId}/runs/${runId}/resume`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload }),
        },
        'Erro ao retomar o workflow',
      ),
    onSuccess: (_data, { workflowId }) => {
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

export function useCrmWorkflowRun(
  workspaceId: string,
  workflowId: string | null,
  runId: string | null,
) {
  return useQuery({
    queryKey: ['crm-workflow-run', workspaceId, workflowId, runId],
    queryFn: () =>
      apiFetch<CrmWorkflowRunDTO>(
        `/api/workspaces/${workspaceId}/crm/workflows/${workflowId}/runs/${runId}`,
        undefined,
        'Execução não encontrada.',
      ),
    enabled: !!workspaceId && !!workflowId && !!runId,
    refetchInterval: (query) =>
      query.state.data?.status === 'RUNNING' ||
      query.state.data?.status === 'PENDING'
        ? 2000
        : false,
  })
}
