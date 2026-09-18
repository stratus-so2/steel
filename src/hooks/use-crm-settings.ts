import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UpdateCrmSettingsDTO } from '@/src/schemas/crm-settings.schema'
import type { CrmSettingsDTO } from '@/types/crm-settings'
import { apiFetch } from './_fetch'

export function crmSettingsKey(workspaceId: string) {
  return ['crm-settings', workspaceId] as const
}

/** Configurações do CRM (valores padrão enquanto a workspace não salvar). */
export function useCrmSettings(workspaceId: string) {
  return useQuery({
    queryKey: crmSettingsKey(workspaceId),
    queryFn: () =>
      apiFetch<CrmSettingsDTO>(
        `/api/workspaces/${workspaceId}/crm/settings`,
        undefined,
        'Erro ao carregar as configurações do CRM',
      ),
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
  })
}

export function useUpdateCrmSettings(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateCrmSettingsDTO) =>
      apiFetch<CrmSettingsDTO>(
        `/api/workspaces/${workspaceId}/crm/settings`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao salvar as configurações do CRM',
      ),
    onSuccess: (settings) => {
      queryClient.setQueryData(crmSettingsKey(workspaceId), settings)
    },
  })
}
