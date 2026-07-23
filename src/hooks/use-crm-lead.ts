import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CrmPersonDTO } from '@/types/crm-person'
import { apiFetch } from './_fetch'

function leadsKey(workspaceId: string) {
  return ['crm-leads', workspaceId] as const
}

export function useConvertCrmLead(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (leadId: string) =>
      apiFetch<CrmPersonDTO>(
        `/api/workspaces/${workspaceId}/crm/leads/${leadId}/convert`,
        { method: 'POST' },
        'Erro ao converter lead',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadsKey(workspaceId) })
    },
  })
}
