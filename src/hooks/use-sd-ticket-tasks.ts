import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  SdTaskStatusDTO,
  SdTicketTaskDTO,
  SdTicketTaskListDTO,
} from '@/types/sd-ticket-task'
import { apiFetch, apiSend } from './_fetch'
import { sdJson, sdTicketTabKey, sdTicketTabUrl } from './_sd-ticket-tab'

export interface SdTicketTaskInput {
  title?: string
  description?: string | null
  assigneeId?: string | null
  /** ISO 8601. */
  dueDate?: string | null
  status?: SdTaskStatusDTO
}

export function useSdTicketTasks(workspaceId: string, ticketRef: string) {
  return useQuery({
    queryKey: sdTicketTabKey(workspaceId, ticketRef, 'tasks'),
    queryFn: () =>
      apiFetch<SdTicketTaskListDTO>(
        sdTicketTabUrl(workspaceId, ticketRef, 'tasks'),
        undefined,
        'Erro ao carregar as tarefas',
      ),
    enabled: Boolean(workspaceId && ticketRef),
  })
}

function useInvalidate(workspaceId: string, ticketRef: string) {
  const qc = useQueryClient()
  return () =>
    qc.invalidateQueries({
      queryKey: sdTicketTabKey(workspaceId, ticketRef, 'tasks'),
    })
}

export function useCreateSdTicketTask(workspaceId: string, ticketRef: string) {
  const invalidate = useInvalidate(workspaceId, ticketRef)
  return useMutation({
    mutationFn: (input: SdTicketTaskInput & { title: string }) =>
      apiFetch<SdTicketTaskDTO>(
        sdTicketTabUrl(workspaceId, ticketRef, 'tasks'),
        sdJson('POST', input),
        'Erro ao criar a tarefa',
      ),
    onSuccess: invalidate,
  })
}

export function useUpdateSdTicketTask(workspaceId: string, ticketRef: string) {
  const invalidate = useInvalidate(workspaceId, ticketRef)
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SdTicketTaskInput }) =>
      apiFetch<SdTicketTaskDTO>(
        `${sdTicketTabUrl(workspaceId, ticketRef, 'tasks')}/${id}`,
        sdJson('PATCH', data),
        'Erro ao salvar a tarefa',
      ),
    onSuccess: invalidate,
  })
}

export function useDeleteSdTicketTask(workspaceId: string, ticketRef: string) {
  const invalidate = useInvalidate(workspaceId, ticketRef)
  return useMutation({
    mutationFn: (id: string) =>
      apiSend(
        `${sdTicketTabUrl(workspaceId, ticketRef, 'tasks')}/${id}`,
        { method: 'DELETE' },
        'Erro ao excluir a tarefa',
      ),
    onSuccess: invalidate,
  })
}

export function useReorderSdTicketTasks(
  workspaceId: string,
  ticketRef: string,
) {
  const invalidate = useInvalidate(workspaceId, ticketRef)
  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      apiFetch<SdTicketTaskListDTO>(
        `${sdTicketTabUrl(workspaceId, ticketRef, 'tasks')}/reorder`,
        sdJson('PATCH', { orderedIds }),
        'Erro ao reordenar as tarefas',
      ),
    onSettled: invalidate,
  })
}
