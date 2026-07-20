import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { WhatsAppAiConfigDTO } from '@/types/whatsapp-ai-config'
import { apiFetch } from './_fetch'

const AI_CONFIG_KEY = (workspaceId: string) =>
  ['whatsapp-ai-config', workspaceId] as const

interface SaveAiConfigInput {
  openaiApiKey?: string
  model?: string
  systemPrompt?: string
  active?: boolean
  readMedia?: boolean
}

export function useWhatsAppAiConfig(workspaceId: string) {
  return useQuery({
    queryKey: AI_CONFIG_KEY(workspaceId),
    queryFn: () =>
      apiFetch<WhatsAppAiConfigDTO | null>(
        `/api/workspaces/${workspaceId}/whatsapp/ai-config`,
        undefined,
        'Erro ao buscar configuração de IA',
      ),
    staleTime: 60 * 1000,
  })
}

export function useSaveWhatsAppAiConfig(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: SaveAiConfigInput) =>
      apiFetch<WhatsAppAiConfigDTO>(
        `/api/workspaces/${workspaceId}/whatsapp/ai-config`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao salvar configuração de IA',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AI_CONFIG_KEY(workspaceId) })
    },
  })
}
