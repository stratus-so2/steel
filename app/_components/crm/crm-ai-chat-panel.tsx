'use client'

import {
  Attachment01Icon,
  Delete02Icon,
  PlusSignIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useRef, useState } from 'react'
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
  useUploadCrmAiAttachment,
} from '@/src/hooks/use-crm-ai'
import type { CrmAiAttachmentDTO } from '@/types/crm-ai'

export function CrmAiChatPanel({ workspaceId }: { workspaceId: string }) {
  const { data: conversations } = useCrmAiConversations(workspaceId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const createConversation = useCreateCrmAiConversation(workspaceId)
  const deleteConversation = useDeleteCrmAiConversation(workspaceId)
  const { data: messages } = useCrmAiMessages(workspaceId, selectedId)
  const sendMessage = useSendCrmAiMessage(workspaceId, selectedId)
  const uploadAttachment = useUploadCrmAiAttachment(workspaceId, selectedId)
  const [draft, setDraft] = useState('')
  const [pendingAttachments, setPendingAttachments] = useState<
    CrmAiAttachmentDTO[]
  >([])
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      await sendMessage.mutateAsync({
        content: draft,
        attachmentIds: pendingAttachments.map((a) => a.id),
      })
      setDraft('')
      setPendingAttachments([])
    } catch (err) {
      notify.error(err)
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const attachment = await uploadAttachment.mutateAsync(file)
      setPendingAttachments((current) => [...current, attachment])
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
                  {message.attachments?.map((attachment) => (
                    <div key={attachment.id} className='mt-1'>
                      {attachment.kind === 'IMAGE' && attachment.url ? (
                        <img
                          src={attachment.url}
                          alt={attachment.filename}
                          className='max-h-32 rounded-md'
                        />
                      ) : (
                        <span className='text-muted-foreground text-xs underline'>
                          {attachment.filename}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {pendingAttachments.length > 0 && (
              <div className='flex flex-wrap gap-2'>
                {pendingAttachments.map((attachment) => (
                  <span
                    key={attachment.id}
                    className='rounded-md bg-muted px-2 py-1 text-xs'
                  >
                    {attachment.filename}
                  </span>
                ))}
              </div>
            )}
            <form onSubmit={handleSend} className='flex gap-2'>
              <input
                ref={fileInputRef}
                type='file'
                accept='image/jpeg,image/png,image/webp,application/pdf,text/plain'
                className='hidden'
                onChange={handleFileSelect}
              />
              <Button
                type='button'
                variant='outline'
                size='icon-sm'
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadAttachment.isPending}
              >
                <SteelIcon icon={Attachment01Icon} strokeWidth={2} />
              </Button>
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
