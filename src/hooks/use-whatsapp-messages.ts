import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  WhatsAppMessageDTO,
  WhatsAppMessageTypeDTO,
} from '@/types/whatsapp-message'
import { apiFetch } from './_fetch'

const MESSAGES_KEY = (workspaceId: string, conversationId: string) =>
  ['whatsapp-messages', workspaceId, conversationId] as const

export function useWhatsAppMessages(
  workspaceId: string,
  conversationId: string | undefined,
) {
  return useQuery({
    queryKey: MESSAGES_KEY(workspaceId, conversationId ?? ''),
    queryFn: () =>
      apiFetch<WhatsAppMessageDTO[]>(
        `/api/workspaces/${workspaceId}/whatsapp/conversations/${conversationId}/messages`,
        undefined,
        'Erro ao buscar mensagens',
      ),
    enabled: Boolean(conversationId),
    staleTime: 10 * 1000,
  })
}

interface SendWhatsAppTextInput {
  text: string
  replyToMessageId?: string
}

export function useSendWhatsAppTextMessage(
  workspaceId: string,
  conversationId: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: SendWhatsAppTextInput) =>
      apiFetch<WhatsAppMessageDTO>(
        `/api/workspaces/${workspaceId}/whatsapp/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao enviar mensagem',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: MESSAGES_KEY(workspaceId, conversationId),
      })
      queryClient.invalidateQueries({
        queryKey: ['whatsapp-conversations', workspaceId],
      })
    },
  })
}

interface SendWhatsAppMediaInput {
  mediaUrl: string
  type: WhatsAppMessageTypeDTO
  caption?: string
  fileName?: string
  replyToMessageId?: string
}

interface SendWhatsAppTemplateInput {
  templateName: string
  language: string
  components?: unknown[]
}

export function useSendWhatsAppTemplateMessage(
  workspaceId: string,
  conversationId: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: SendWhatsAppTemplateInput) =>
      apiFetch<WhatsAppMessageDTO>(
        `/api/workspaces/${workspaceId}/whatsapp/conversations/${conversationId}/messages/template`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao enviar template',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: MESSAGES_KEY(workspaceId, conversationId),
      })
      queryClient.invalidateQueries({
        queryKey: ['whatsapp-conversations', workspaceId],
      })
    },
  })
}

export function useReactToWhatsAppMessage(
  workspaceId: string,
  conversationId: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      apiFetch<WhatsAppMessageDTO>(
        `/api/workspaces/${workspaceId}/whatsapp/conversations/${conversationId}/messages/${messageId}/react`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emoji }),
        },
        'Erro ao reagir à mensagem',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: MESSAGES_KEY(workspaceId, conversationId),
      })
    },
  })
}

export function useSendWhatsAppMediaMessage(
  workspaceId: string,
  conversationId: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: SendWhatsAppMediaInput) =>
      apiFetch<WhatsAppMessageDTO>(
        `/api/workspaces/${workspaceId}/whatsapp/conversations/${conversationId}/messages/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao enviar mídia',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: MESSAGES_KEY(workspaceId, conversationId),
      })
      queryClient.invalidateQueries({
        queryKey: ['whatsapp-conversations', workspaceId],
      })
    },
  })
}
