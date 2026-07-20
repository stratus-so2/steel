import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { WhatsAppTemplateDTO } from '@/types/whatsapp-template'
import { apiFetch } from './_fetch'

const TEMPLATES_KEY = (workspaceId: string) =>
  ['whatsapp-templates', workspaceId] as const

export function useWhatsAppTemplates(workspaceId: string) {
  return useQuery({
    queryKey: TEMPLATES_KEY(workspaceId),
    queryFn: () =>
      apiFetch<WhatsAppTemplateDTO[]>(
        `/api/workspaces/${workspaceId}/whatsapp/templates`,
        undefined,
        'Erro ao buscar templates',
      ),
    staleTime: 5 * 60 * 1000,
  })
}

export function useSyncWhatsAppTemplates(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (connectionId: string) =>
      apiFetch<WhatsAppTemplateDTO[]>(
        `/api/workspaces/${workspaceId}/whatsapp/templates/sync`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connectionId }),
        },
        'Erro ao sincronizar templates',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY(workspaceId) })
    },
  })
}
