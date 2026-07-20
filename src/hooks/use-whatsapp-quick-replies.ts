import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { WhatsAppQuickReplyDTO } from '@/types/whatsapp-quick-reply'
import { apiFetch, apiSend } from './_fetch'

const QUICK_REPLIES_KEY = (workspaceId: string) =>
  ['whatsapp-quick-replies', workspaceId] as const

interface QuickReplyInput {
  shortcut: string
  title: string
  body: string
  mediaUrl?: string
}

export function useWhatsAppQuickReplies(workspaceId: string) {
  return useQuery({
    queryKey: QUICK_REPLIES_KEY(workspaceId),
    queryFn: () =>
      apiFetch<WhatsAppQuickReplyDTO[]>(
        `/api/workspaces/${workspaceId}/whatsapp/quick-replies`,
        undefined,
        'Erro ao buscar mensagens rápidas',
      ),
    staleTime: 60 * 1000,
  })
}

export function useCreateWhatsAppQuickReply(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: QuickReplyInput) =>
      apiFetch<WhatsAppQuickReplyDTO>(
        `/api/workspaces/${workspaceId}/whatsapp/quick-replies`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao criar mensagem rápida',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUICK_REPLIES_KEY(workspaceId),
      })
    },
  })
}

export function useUpdateWhatsAppQuickReply(
  workspaceId: string,
  quickReplyId: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Partial<QuickReplyInput>) =>
      apiFetch<WhatsAppQuickReplyDTO>(
        `/api/workspaces/${workspaceId}/whatsapp/quick-replies/${quickReplyId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao atualizar mensagem rápida',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUICK_REPLIES_KEY(workspaceId),
      })
    },
  })
}

export function useDeleteWhatsAppQuickReply(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (quickReplyId: string) =>
      apiSend(
        `/api/workspaces/${workspaceId}/whatsapp/quick-replies/${quickReplyId}`,
        { method: 'DELETE' },
        'Erro ao remover mensagem rápida',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUICK_REPLIES_KEY(workspaceId),
      })
    },
  })
}
