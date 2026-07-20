import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  WhatsAppAssignableMemberDTO,
  WhatsAppConversationDTO,
  WhatsAppConversationStatusDTO,
} from '@/types/whatsapp-conversation'
import { apiFetch } from './_fetch'

const CONVERSATIONS_KEY = (workspaceId: string, status?: string) =>
  ['whatsapp-conversations', workspaceId, status ?? ''] as const

export function useWhatsAppConversations(
  workspaceId: string,
  status?: WhatsAppConversationStatusDTO,
) {
  return useQuery({
    queryKey: CONVERSATIONS_KEY(workspaceId, status),
    queryFn: () =>
      apiFetch<WhatsAppConversationDTO[]>(
        `/api/workspaces/${workspaceId}/whatsapp/conversations${status ? `?status=${status}` : ''}`,
        undefined,
        'Erro ao buscar conversas',
      ),
    staleTime: 15 * 1000,
  })
}

export function useStartWhatsAppConversation(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { contactId: string; connectionId: string }) =>
      apiFetch<WhatsAppConversationDTO>(
        `/api/workspaces/${workspaceId}/whatsapp/conversations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao iniciar conversa',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['whatsapp-conversations', workspaceId],
      })
    },
  })
}

export function useMarkWhatsAppConversationRead(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (conversationId: string) =>
      apiFetch<WhatsAppConversationDTO>(
        `/api/workspaces/${workspaceId}/whatsapp/conversations/${conversationId}/read`,
        { method: 'POST' },
        'Erro ao marcar conversa como lida',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['whatsapp-conversations', workspaceId],
      })
    },
  })
}

export function useRemoveWhatsAppConversationFromAi(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (conversationId: string) =>
      apiFetch<WhatsAppConversationDTO>(
        `/api/workspaces/${workspaceId}/whatsapp/conversations/${conversationId}/ai`,
        { method: 'PATCH' },
        'Erro ao remover conversa do atendimento da IA',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['whatsapp-conversations', workspaceId],
      })
    },
  })
}

export function useWhatsAppAssignableMembers(workspaceId: string) {
  return useQuery({
    queryKey: ['whatsapp-assignable-members', workspaceId],
    queryFn: () =>
      apiFetch<WhatsAppAssignableMemberDTO[]>(
        `/api/workspaces/${workspaceId}/whatsapp/assignable-members`,
        undefined,
        'Erro ao buscar membros do workspace',
      ),
    staleTime: 5 * 60 * 1000,
  })
}

export function useAssignWhatsAppConversation(
  workspaceId: string,
  conversationId: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (assignedUserId: string | null) =>
      apiFetch<WhatsAppConversationDTO>(
        `/api/workspaces/${workspaceId}/whatsapp/conversations/${conversationId}/assign`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignedUserId }),
        },
        'Erro ao transferir conversa',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['whatsapp-conversations', workspaceId],
      })
    },
  })
}
