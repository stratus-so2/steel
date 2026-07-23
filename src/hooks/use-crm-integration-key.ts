import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CrmIntegrationKeyCreatedDTO,
  CrmIntegrationKeyDTO,
} from '@/types/crm-integration-key'
import { apiFetch, apiSend } from './_fetch'

function keysKey(workspaceId: string) {
  return ['crm-integration-keys', workspaceId] as const
}

export function useCrmIntegrationKeys(workspaceId: string) {
  return useQuery({
    queryKey: keysKey(workspaceId),
    queryFn: () =>
      apiFetch<CrmIntegrationKeyDTO[]>(
        `/api/workspaces/${workspaceId}/crm/integration-keys`,
        undefined,
        'Erro ao buscar chaves de integração',
      ),
    enabled: !!workspaceId,
  })
}

export function useCreateCrmIntegrationKey(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<CrmIntegrationKeyCreatedDTO>(
        `/api/workspaces/${workspaceId}/crm/integration-keys`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        },
        'Erro ao criar chave',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keysKey(workspaceId) })
    },
  })
}

export function useRevokeCrmIntegrationKey(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (keyId: string) =>
      apiSend(
        `/api/workspaces/${workspaceId}/crm/integration-keys/${keyId}`,
        { method: 'DELETE' },
        'Erro ao revogar chave',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keysKey(workspaceId) })
    },
  })
}
