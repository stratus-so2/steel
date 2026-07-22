import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { WhatsAppConversationDTO } from '@/types/whatsapp-conversation'
import type { WhatsAppMessageDTO } from '@/types/whatsapp-message'

type WhatsAppRealtimeEvent =
  | {
      type: 'message.created'
      conversationId: string
      message: WhatsAppMessageDTO
    }
  | {
      type: 'message.updated'
      conversationId: string
      message: WhatsAppMessageDTO
    }
  | { type: 'conversation.updated'; conversation: WhatsAppConversationDTO }
  | { type: 'conversation.deleted'; conversationId: string }

export function useWhatsAppRealtimeEvents(workspaceId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!workspaceId) return

    const source = new EventSource(
      `/api/whatsapp/events?workspaceId=${workspaceId}`,
    )

    source.onmessage = (event) => {
      let parsed: WhatsAppRealtimeEvent
      try {
        parsed = JSON.parse(event.data)
      } catch {
        return
      }

      if (
        parsed.type === 'message.created' ||
        parsed.type === 'message.updated'
      ) {
        queryClient.invalidateQueries({
          queryKey: ['whatsapp-messages', workspaceId, parsed.conversationId],
        })
        queryClient.invalidateQueries({
          queryKey: ['whatsapp-conversations', workspaceId],
        })
      }

      if (
        parsed.type === 'conversation.updated' ||
        parsed.type === 'conversation.deleted'
      ) {
        queryClient.invalidateQueries({
          queryKey: ['whatsapp-conversations', workspaceId],
        })
      }
    }

    return () => {
      source.close()
    }
  }, [workspaceId, queryClient])
}
