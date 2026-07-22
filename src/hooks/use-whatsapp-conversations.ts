import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  WhatsAppAssignableMemberDTO,
  WhatsAppConversationDTO,
  WhatsAppConversationStatusDTO,
} from '@/types/whatsapp-conversation'
import { apiFetch } from './_fetch'

const CONVERSATIONS_KEY = (
  workspaceId: string,
  status?: string,
  archived?: boolean,
) =>
  [
    'whatsapp-conversations',
    workspaceId,
    status ?? '',
    archived ?? false,
  ] as const

export function useWhatsAppConversations(
  workspaceId: string,
  status?: WhatsAppConversationStatusDTO,
  archived?: boolean,
) {
  return useQuery({
    queryKey: CONVERSATIONS_KEY(workspaceId, status, archived),
    queryFn: () => {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (archived) params.set('archived', 'true')
      const qs = params.toString()
      return apiFetch<WhatsAppConversationDTO[]>(
        `/api/workspaces/${workspaceId}/whatsapp/conversations${qs ? `?${qs}` : ''}`,
        undefined,
        'Erro ao buscar conversas',
      )
    },
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

function invalidateConversations(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
) {
  queryClient.invalidateQueries({
    queryKey: ['whatsapp-conversations', workspaceId],
  })
}

export function usePinWhatsAppConversation(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      conversationId,
      pinned,
    }: {
      conversationId: string
      pinned: boolean
    }) =>
      apiFetch<WhatsAppConversationDTO>(
        `/api/workspaces/${workspaceId}/whatsapp/conversations/${conversationId}/pin`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pinned }),
        },
        'Erro ao fixar conversa',
      ),
    onSuccess: () => invalidateConversations(queryClient, workspaceId),
  })
}

export function useArchiveWhatsAppConversation(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      conversationId,
      archived,
    }: {
      conversationId: string
      archived: boolean
    }) =>
      apiFetch<WhatsAppConversationDTO>(
        `/api/workspaces/${workspaceId}/whatsapp/conversations/${conversationId}/archive`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ archived }),
        },
        'Erro ao arquivar conversa',
      ),
    onSuccess: () => invalidateConversations(queryClient, workspaceId),
  })
}

export function useDeleteWhatsAppConversation(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (conversationId: string) =>
      apiFetch<{ id: string }>(
        `/api/workspaces/${workspaceId}/whatsapp/conversations/${conversationId}`,
        { method: 'DELETE' },
        'Erro ao excluir conversa',
      ),
    onSuccess: () => invalidateConversations(queryClient, workspaceId),
  })
}

export function useClearWhatsAppChat(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (conversationId: string) =>
      apiFetch<WhatsAppConversationDTO>(
        `/api/workspaces/${workspaceId}/whatsapp/conversations/${conversationId}/clear`,
        { method: 'POST' },
        'Erro ao limpar conversa',
      ),
    onSuccess: () => invalidateConversations(queryClient, workspaceId),
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
