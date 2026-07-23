import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CrmNoteDTO } from '@/types/crm-note'
import { apiFetch, apiSend } from './_fetch'

function notesKey(workspaceId: string) {
  return ['crm-notes', workspaceId] as const
}

export function useCrmNotes(workspaceId: string) {
  return useQuery({
    queryKey: notesKey(workspaceId),
    queryFn: () =>
      apiFetch<CrmNoteDTO[]>(
        `/api/workspaces/${workspaceId}/crm/notes`,
        undefined,
        'Erro ao buscar notas',
      ),
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
  })
}

export function useCreateCrmNote(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { body: string }) =>
      apiFetch<CrmNoteDTO>(
        `/api/workspaces/${workspaceId}/crm/notes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao criar nota',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notesKey(workspaceId) })
    },
  })
}

export function useDeleteCrmNote(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (noteId: string) =>
      apiSend(
        `/api/workspaces/${workspaceId}/crm/notes/${noteId}`,
        { method: 'DELETE' },
        'Erro ao remover nota',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notesKey(workspaceId) })
    },
  })
}
