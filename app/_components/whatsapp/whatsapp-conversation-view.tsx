'use client'

import {
  ComputerVideoCallIcon,
  UserSwitchIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useEffect, useMemo, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { MessageBubble } from '@/components/ui/chat/message-bubble'
import { MessageScroller } from '@/components/ui/chat/message-scroller'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { notify } from '@/lib/notify'
import { useUser } from '@/src/hooks/use-user'
import {
  useAssignWhatsAppConversation,
  useMarkWhatsAppConversationRead,
  useRemoveWhatsAppConversationFromAi,
  useWhatsAppAssignableMembers,
} from '@/src/hooks/use-whatsapp-conversations'
import {
  useReactToWhatsAppMessage,
  useSendWhatsAppTextMessage,
  useWhatsAppMessages,
} from '@/src/hooks/use-whatsapp-messages'
import type { WhatsAppConversationDTO } from '@/types/whatsapp-conversation'
import type { WhatsAppMessageDTO } from '@/types/whatsapp-message'
import { WhatsappAiBanner } from './whatsapp-ai-banner'
import { WhatsappComposer } from './whatsapp-composer'
import { WhatsappVideoCallDialog } from './whatsapp-video-call-dialog'

export function WhatsappConversationView({
  workspaceId,
  conversation,
}: {
  workspaceId: string
  conversation: WhatsAppConversationDTO
}) {
  const [callOpen, setCallOpen] = useState(false)
  const [replyTarget, setReplyTarget] = useState<WhatsAppMessageDTO | null>(
    null,
  )
  const roomName = `steel-${conversation.id}`

  const currentUser = useUser()
  const messages = useWhatsAppMessages(workspaceId, conversation.id)
  const markRead = useMarkWhatsAppConversationRead(workspaceId)
  const removeFromAi = useRemoveWhatsAppConversationFromAi(workspaceId)
  const assignableMembers = useWhatsAppAssignableMembers(workspaceId)
  const assignConversation = useAssignWhatsAppConversation(
    workspaceId,
    conversation.id,
  )
  const sendText = useSendWhatsAppTextMessage(workspaceId, conversation.id)
  const reactToMessage = useReactToWhatsAppMessage(workspaceId, conversation.id)

  const messagesById = useMemo(() => {
    const map = new Map<string, WhatsAppMessageDTO>()
    for (const message of messages.data ?? []) map.set(message.id, message)
    return map
  }, [messages.data])

  useEffect(() => {
    if (conversation.unreadCount > 0) {
      markRead.mutate(conversation.id)
    }
  }, [conversation.id])

  async function handleStartCall() {
    try {
      await sendText.mutateAsync({
        text: `Vamos iniciar uma videochamada. Entre pelo link: https://meet.jit.si/${roomName}`,
      })
      setCallOpen(true)
    } catch {
      notify.error('Erro ao iniciar chamada')
    }
  }

  return (
    <div className='flex h-full min-w-0 flex-1 flex-col'>
      <div className='flex items-center justify-between gap-3 border-b px-4 py-3'>
        <div className='flex items-center gap-2.5'>
          <Avatar>
            <AvatarImage src={conversation.contactAvatarUrl ?? undefined} />
            <AvatarFallback>
              {(conversation.contactName ?? conversation.contactWaId)
                .slice(0, 2)
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className='font-medium text-sm'>
              {conversation.contactName ?? conversation.contactWaId}
            </p>
            <p className='text-muted-foreground text-xs'>
              {conversation.contactWaId}
            </p>
          </div>
        </div>
        <div className='flex items-center gap-1'>
          <Button
            variant='ghost'
            size='icon-sm'
            aria-label='Iniciar chamada de vídeo'
            onClick={handleStartCall}
          >
            <SteelIcon icon={ComputerVideoCallIcon} size={18} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant='ghost'
                  size='icon-sm'
                  aria-label='Transferir conversa'
                >
                  <SteelIcon icon={UserSwitchIcon} size={18} />
                </Button>
              }
            />
            <DropdownMenuContent align='end'>
              {assignableMembers.data?.length ? (
                assignableMembers.data.map((member) => (
                  <DropdownMenuItem
                    key={member.id}
                    disabled={
                      assignConversation.isPending ||
                      member.id === conversation.assignedUserId
                    }
                    onClick={() => assignConversation.mutate(member.id)}
                  >
                    {member.name}
                    {member.id === currentUser.data?.id ? ' (você)' : ''}
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled>
                  Nenhum membro disponível
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {conversation.aiActive && (
        <WhatsappAiBanner
          isRemoving={removeFromAi.isPending}
          onRemoveFromAi={() => removeFromAi.mutate(conversation.id)}
        />
      )}

      <MessageScroller dependencyKey={messages.data?.length}>
        {(messages.data ?? []).map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            replyToMessage={
              message.replyToMessageId
                ? messagesById.get(message.replyToMessageId)
                : undefined
            }
            onReply={setReplyTarget}
            onReact={(messageId, emoji) =>
              reactToMessage.mutate({ messageId, emoji })
            }
          />
        ))}
      </MessageScroller>

      <WhatsappComposer
        workspaceId={workspaceId}
        conversationId={conversation.id}
        disabled={conversation.aiActive}
        replyTarget={replyTarget}
        onClearReply={() => setReplyTarget(null)}
      />

      <WhatsappVideoCallDialog
        open={callOpen}
        onOpenChange={setCallOpen}
        roomName={roomName}
        displayName={currentUser.data?.name ?? 'Atendente'}
      />
    </div>
  )
}
