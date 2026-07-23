import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CrmPersonDTO } from '@/types/crm-person'
import { apiFetch, apiSend } from './_fetch'

function peopleKey(workspaceId: string) {
  return ['crm-people', workspaceId] as const
}

export function useCrmPeople(workspaceId: string) {
  return useQuery({
    queryKey: peopleKey(workspaceId),
    queryFn: () =>
      apiFetch<CrmPersonDTO[]>(
        `/api/workspaces/${workspaceId}/crm/people`,
        undefined,
        'Erro ao buscar pessoas',
      ),
    enabled: !!workspaceId,
    staleTime: 2 * 60 * 1000,
  })
}

export function useCreateCrmPerson(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { name: string; companyId?: string }) =>
      apiFetch<CrmPersonDTO>(
        `/api/workspaces/${workspaceId}/crm/people`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao criar pessoa',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: peopleKey(workspaceId) })
    },
  })
}

export function useDeleteCrmPerson(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (personId: string) =>
      apiSend(
        `/api/workspaces/${workspaceId}/crm/people/${personId}`,
        { method: 'DELETE' },
        'Erro ao remover pessoa',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: peopleKey(workspaceId) })
    },
  })
}
