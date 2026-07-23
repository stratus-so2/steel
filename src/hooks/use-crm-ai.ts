import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CrmAiAttachmentDTO,
  CrmAiConversationDTO,
  CrmAiMessageDTO,
} from '@/types/crm-ai'
import { apiFetch, apiSend } from './_fetch'

function conversationsKey(workspaceId: string) {
  return ['crm-ai-conversations', workspaceId] as const
}

function messagesKey(workspaceId: string, conversationId: string | null) {
  return ['crm-ai-messages', workspaceId, conversationId] as const
}

export function useCrmAiConversations(workspaceId: string) {
  return useQuery({
    queryKey: conversationsKey(workspaceId),
    queryFn: () =>
      apiFetch<CrmAiConversationDTO[]>(
        `/api/workspaces/${workspaceId}/crm/ai/conversations`,
        undefined,
        'Erro ao buscar conversas',
      ),
    enabled: !!workspaceId,
  })
}

export function useCreateCrmAiConversation(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      apiFetch<CrmAiConversationDTO>(
        `/api/workspaces/${workspaceId}/crm/ai/conversations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
        'Erro ao criar conversa',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationsKey(workspaceId) })
    },
  })
}

export function useDeleteCrmAiConversation(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (conversationId: string) =>
      apiSend(
        `/api/workspaces/${workspaceId}/crm/ai/conversations/${conversationId}`,
        { method: 'DELETE' },
        'Erro ao remover conversa',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationsKey(workspaceId) })
    },
  })
}

export function useCrmAiMessages(
  workspaceId: string,
  conversationId: string | null,
) {
  return useQuery({
    queryKey: messagesKey(workspaceId, conversationId),
    queryFn: () =>
      apiFetch<CrmAiMessageDTO[]>(
        `/api/workspaces/${workspaceId}/crm/ai/conversations/${conversationId}`,
        undefined,
        'Erro ao buscar mensagens',
      ),
    enabled: !!workspaceId && !!conversationId,
  })
}

export function useSendCrmAiMessage(
  workspaceId: string,
  conversationId: string | null,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      content,
      attachmentIds,
    }: {
      content: string
      attachmentIds?: string[]
    }) =>
      apiFetch<CrmAiMessageDTO>(
        `/api/workspaces/${workspaceId}/crm/ai/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, attachmentIds }),
        },
        'Erro ao enviar mensagem',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: messagesKey(workspaceId, conversationId),
      })
    },
  })
}

export function useUploadCrmAiAttachment(
  workspaceId: string,
  conversationId: string | null,
) {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(
        `/api/workspaces/${workspaceId}/crm/ai/conversations/${conversationId}/attachments`,
        { method: 'POST', body: form },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.message ?? 'Erro ao enviar anexo')
      }
      const json = await res.json()
      return json.data as CrmAiAttachmentDTO
    },
  })
}
