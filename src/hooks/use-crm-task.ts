import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CrmTaskDTO, CrmTaskStatusDTO } from '@/types/crm-task'
import { apiFetch, apiSend } from './_fetch'

function tasksKey(workspaceId: string) {
  return ['crm-tasks', workspaceId] as const
}

export function useCrmTasks(workspaceId: string) {
  return useQuery({
    queryKey: tasksKey(workspaceId),
    queryFn: () =>
      apiFetch<CrmTaskDTO[]>(
        `/api/workspaces/${workspaceId}/crm/tasks`,
        undefined,
        'Erro ao buscar tarefas',
      ),
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
  })
}

export function useCreateCrmTask(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { title: string }) =>
      apiFetch<CrmTaskDTO>(
        `/api/workspaces/${workspaceId}/crm/tasks`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao criar tarefa',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey(workspaceId) })
    },
  })
}

export function useUpdateCrmTaskStatus(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      taskId,
      status,
    }: {
      taskId: string
      status: CrmTaskStatusDTO
    }) =>
      apiFetch<CrmTaskDTO>(
        `/api/workspaces/${workspaceId}/crm/tasks/${taskId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        },
        'Erro ao atualizar tarefa',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey(workspaceId) })
    },
  })
}

export function useDeleteCrmTask(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (taskId: string) =>
      apiSend(
        `/api/workspaces/${workspaceId}/crm/tasks/${taskId}`,
        { method: 'DELETE' },
        'Erro ao remover tarefa',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey(workspaceId) })
    },
  })
}
