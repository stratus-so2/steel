import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CrmLeadDTO, CrmLeadStatusDTO } from '@/types/crm-lead'
import type { CrmPersonDTO } from '@/types/crm-person'
import { apiFetch, apiSend } from './_fetch'

function leadsKey(workspaceId: string) {
  return ['crm-leads', workspaceId] as const
}

export function useCrmLeads(workspaceId: string) {
  return useQuery({
    queryKey: leadsKey(workspaceId),
    queryFn: () =>
      apiFetch<CrmLeadDTO[]>(
        `/api/workspaces/${workspaceId}/crm/leads`,
        undefined,
        'Erro ao buscar leads',
      ),
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
  })
}

export function useCreateCrmLead(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { name: string; emails?: string[]; source?: string }) =>
      apiFetch<CrmLeadDTO>(
        `/api/workspaces/${workspaceId}/crm/leads`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao criar lead',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadsKey(workspaceId) })
    },
  })
}

export function useUpdateCrmLeadStatus(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      leadId,
      status,
    }: {
      leadId: string
      status: CrmLeadStatusDTO
    }) =>
      apiFetch<CrmLeadDTO>(
        `/api/workspaces/${workspaceId}/crm/leads/${leadId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        },
        'Erro ao atualizar lead',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadsKey(workspaceId) })
    },
  })
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

export function useDeleteCrmLead(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (leadId: string) =>
      apiSend(
        `/api/workspaces/${workspaceId}/crm/leads/${leadId}`,
        { method: 'DELETE' },
        'Erro ao remover lead',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadsKey(workspaceId) })
    },
  })
}
