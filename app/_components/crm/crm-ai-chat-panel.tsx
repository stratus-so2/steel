'use client'

import { Delete02Icon, PlusSignIcon } from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { notify } from '@/lib/notify'
import {
  useCreateCrmAiConversation,
  useCrmAiConversations,
  useCrmAiMessages,
  useDeleteCrmAiConversation,
  useSendCrmAiMessage,
} from '@/src/hooks/use-crm-ai'

export function CrmAiChatPanel({ workspaceId }: { workspaceId: string }) {
  const { data: conversations } = useCrmAiConversations(workspaceId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const createConversation = useCreateCrmAiConversation(workspaceId)
  const deleteConversation = useDeleteCrmAiConversation(workspaceId)
  const { data: messages } = useCrmAiMessages(workspaceId, selectedId)
  const sendMessage = useSendCrmAiMessage(workspaceId, selectedId)
  const [draft, setDraft] = useState('')

  async function handleNewConversation() {
    try {
      const conversation = await createConversation.mutateAsync()
      setSelectedId(conversation.id)
    } catch (err) {
      notify.error(err)
    }
  }

  async function handleDelete(conversationId: string) {
    try {
      await deleteConversation.mutateAsync(conversationId)
      if (selectedId === conversationId) setSelectedId(null)
    } catch (err) {
      notify.error(err)
    }
  }

  async function handleSend(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!draft.trim()) return
    try {
      await sendMessage.mutateAsync(draft)
      setDraft('')
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
      <div className='flex flex-col gap-2'>
        <Button variant='default' size='xs' onClick={handleNewConversation}>
          <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
          Nova conversa
        </Button>
        {conversations?.map((conversation) => (
          <button
            type='button'
            key={conversation.id}
            onClick={() => setSelectedId(conversation.id)}
            className='flex items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted'
          >
            <span>{conversation.title ?? 'Conversa sem título'}</span>
            <Button
              variant='ghost'
              size='icon-xs'
              onClick={(e) => {
                e.stopPropagation()
                handleDelete(conversation.id)
              }}
            >
              <SteelIcon icon={Delete02Icon} strokeWidth={2} />
            </Button>
          </button>
        ))}
      </div>
      <div className='flex flex-col gap-3 sm:col-span-2'>
        {!selectedId && (
          <p className='text-sm text-muted-foreground'>
            Selecione ou crie uma conversa
          </p>
        )}
        {selectedId && (
          <>
            <div className='flex min-h-40 flex-col gap-2 rounded-md border border-border p-3'>
              {messages?.map((message) => (
                <div
                  key={message.id}
                  className={
                    message.role === 'USER'
                      ? 'self-end rounded-md bg-primary/10 px-3 py-2 text-sm'
                      : 'self-start rounded-md bg-muted px-3 py-2 text-sm'
                  }
                >
                  {message.content}
                </div>
              ))}
            </div>
            <form onSubmit={handleSend} className='flex gap-2'>
              <Input
                placeholder='Pergunte algo sobre seus contatos e oportunidades'
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <Button type='submit' size='sm' disabled={sendMessage.isPending}>
                {sendMessage.isPending ? 'Enviando...' : 'Enviar'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
