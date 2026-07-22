import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { WhatsAppGroupMessageDTO } from '@/types/whatsapp-group-message'
import { apiFetch } from './_fetch'

const GROUP_MESSAGES_KEY = (workspaceId: string, groupId: string) =>
  ['whatsapp-group-messages', workspaceId, groupId] as const

export function useWhatsAppGroupMessages(
  workspaceId: string,
  groupId: string | undefined,
) {
  return useQuery({
    queryKey: GROUP_MESSAGES_KEY(workspaceId, groupId ?? ''),
    queryFn: () =>
      apiFetch<WhatsAppGroupMessageDTO[]>(
        `/api/workspaces/${workspaceId}/whatsapp/groups/${groupId}/messages`,
        undefined,
        'Erro ao buscar mensagens do grupo',
      ),
    enabled: Boolean(groupId),
    staleTime: 10 * 1000,
  })
}

export function useSendWhatsAppGroupTextMessage(
  workspaceId: string,
  groupId: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { text: string; mentionedWaIds?: string[] }) =>
      apiFetch<WhatsAppGroupMessageDTO>(
        `/api/workspaces/${workspaceId}/whatsapp/groups/${groupId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao enviar mensagem',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: GROUP_MESSAGES_KEY(workspaceId, groupId),
      })
      queryClient.invalidateQueries({
        queryKey: ['whatsapp-groups', workspaceId],
      })
    },
  })
}
