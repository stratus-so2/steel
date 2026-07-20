import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  WhatsAppBroadcastListDetailDTO,
  WhatsAppBroadcastListDTO,
} from '@/types/whatsapp-broadcast'
import { apiFetch } from './_fetch'

const BROADCASTS_KEY = (workspaceId: string) =>
  ['whatsapp-broadcasts', workspaceId] as const

interface CreateBroadcastInput {
  connectionId: string
  name: string
  messageBody: string
  mediaUrl?: string
  contactIds: string[]
}

export function useWhatsAppBroadcasts(workspaceId: string) {
  return useQuery({
    queryKey: BROADCASTS_KEY(workspaceId),
    queryFn: () =>
      apiFetch<WhatsAppBroadcastListDTO[]>(
        `/api/workspaces/${workspaceId}/whatsapp/broadcasts`,
        undefined,
        'Erro ao buscar listas de transmissão',
      ),
    staleTime: 15 * 1000,
  })
}

export function useWhatsAppBroadcast(
  workspaceId: string,
  broadcastId: string | undefined,
) {
  return useQuery({
    queryKey: ['whatsapp-broadcast', workspaceId, broadcastId],
    queryFn: () =>
      apiFetch<WhatsAppBroadcastListDetailDTO>(
        `/api/workspaces/${workspaceId}/whatsapp/broadcasts/${broadcastId}`,
        undefined,
        'Erro ao buscar lista de transmissão',
      ),
    enabled: Boolean(broadcastId),
    refetchInterval: (query) =>
      query.state.data?.status === 'RUNNING' ? 3000 : false,
  })
}

export function useCreateWhatsAppBroadcast(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateBroadcastInput) =>
      apiFetch<WhatsAppBroadcastListDetailDTO>(
        `/api/workspaces/${workspaceId}/whatsapp/broadcasts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao criar lista de transmissão',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BROADCASTS_KEY(workspaceId) })
    },
  })
}

export function useStartWhatsAppBroadcast(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (broadcastId: string) =>
      apiFetch<WhatsAppBroadcastListDetailDTO>(
        `/api/workspaces/${workspaceId}/whatsapp/broadcasts/${broadcastId}/start`,
        { method: 'POST' },
        'Erro ao iniciar lista de transmissão',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BROADCASTS_KEY(workspaceId) })
    },
  })
}
