'use client'

import {
  Add01Icon,
  Copy01Icon,
  Delete02Icon,
  SentIcon,
  Settings02Icon,
  ShieldUserIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { type FormEvent, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { MessageScroller } from '@/components/ui/chat/message-scroller'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import { useWhatsAppContacts } from '@/src/hooks/use-whatsapp-contacts'
import {
  useSendWhatsAppGroupTextMessage,
  useWhatsAppGroupMessages,
} from '@/src/hooks/use-whatsapp-group-messages'
import {
  useAddWhatsAppGroupParticipants,
  useLeaveWhatsAppGroup,
  useRemoveWhatsAppGroupParticipants,
  useSetWhatsAppGroupAdmin,
  useUpdateWhatsAppGroup,
  useWhatsAppGroupInviteLink,
} from '@/src/hooks/use-whatsapp-groups'
import type { WhatsAppGroupDTO } from '@/types/whatsapp-group'
import type { WhatsAppGroupMessageDTO } from '@/types/whatsapp-group-message'

function GroupMessageBubble({ message }: { message: WhatsAppGroupMessageDTO }) {
  const isOutbound = message.direction === 'OUT'

  return (
    <div
      className={cn(
        'flex w-full',
        isOutbound ? 'justify-end' : 'justify-start',
      )}
    >
      <div
        className={cn(
          'flex flex-col',
          isOutbound ? 'items-end' : 'items-start',
        )}
      >
        {!isOutbound && message.senderName && (
          <span className='mb-0.5 px-1 font-medium text-primary text-xs'>
            {message.senderName}
          </span>
        )}
        <div
          className={cn(
            'max-w-fit rounded-2xl px-3 py-2 text-sm',
            isOutbound
              ? 'rounded-br-sm bg-primary text-primary-foreground'
              : 'rounded-bl-sm bg-muted text-foreground',
          )}
        >
          <p className='whitespace-pre-wrap break-words'>{message.text}</p>
          <div
            className={cn(
              'mt-1 text-[10px]',
              isOutbound ? 'text-right opacity-80' : 'opacity-60',
            )}
          >
            {new Date(message.createdAt).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function GroupSettingsDialog({
  workspaceId,
  group,
  open,
  onOpenChange,
  onLeft,
}: {
  workspaceId: string
  group: WhatsAppGroupDTO
  open: boolean
  onOpenChange: (open: boolean) => void
  onLeft: () => void
}) {
  const [name, setName] = useState(group.name)
  const [description, setDescription] = useState(group.description ?? '')
  const [newParticipant, setNewParticipant] = useState<string>()

  const contacts = useWhatsAppContacts(workspaceId)
  const updateGroup = useUpdateWhatsAppGroup(workspaceId, group.id)
  const addParticipants = useAddWhatsAppGroupParticipants(workspaceId, group.id)
  const removeParticipants = useRemoveWhatsAppGroupParticipants(
    workspaceId,
    group.id,
  )
  const setAdmin = useSetWhatsAppGroupAdmin(workspaceId, group.id)
  const inviteLink = useWhatsAppGroupInviteLink(workspaceId, group.id)
  const leaveGroup = useLeaveWhatsAppGroup(workspaceId)

  const availableContacts = (contacts.data ?? []).filter(
    (contact) => !group.participants.some((p) => p.waId === contact.waId),
  )

  function handleSaveInfo(event: FormEvent) {
    event.preventDefault()
    updateGroup.mutate(
      { name: name.trim(), description: description.trim() },
      {
        onSuccess: () => notify.success('Grupo atualizado'),
        onError: (error) => notify.error(error, 'Erro ao atualizar grupo'),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>Configurações do grupo</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSaveInfo} className='space-y-3'>
          <div className='space-y-1.5'>
            <Label htmlFor='groupSettingsName'>Nome</Label>
            <Input
              id='groupSettingsName'
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='groupSettingsDescription'>Descrição</Label>
            <Textarea
              id='groupSettingsDescription'
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <Button type='submit' size='sm' disabled={updateGroup.isPending}>
            Salvar
          </Button>
        </form>

        <div className='space-y-1.5 border-t pt-3'>
          <Label>Link de convite</Label>
          <div className='flex gap-2'>
            <Input readOnly value={group.inviteLink ?? ''} placeholder='—' />
            <Button
              type='button'
              variant='outline'
              size='icon-sm'
              disabled={inviteLink.isPending}
              onClick={() =>
                inviteLink.mutate(undefined, {
                  onSuccess: (result) => {
                    navigator.clipboard.writeText(result.inviteLink)
                    notify.success('Link copiado')
                  },
                  onError: (error) =>
                    notify.error(error, 'Erro ao obter link de convite'),
                })
              }
            >
              <SteelIcon icon={Copy01Icon} size={14} />
            </Button>
          </div>
        </div>

        <div className='space-y-1.5 border-t pt-3'>
          <Label>Participantes ({group.participants.length})</Label>
          <div className='max-h-40 space-y-0.5 overflow-y-auto'>
            {group.participants.map((participant) => (
              <div
                key={participant.waId}
                className='flex items-center justify-between gap-2 rounded-sm px-1 py-1 text-sm hover:bg-muted'
              >
                <span className='truncate'>
                  {participant.name ?? participant.waId}
                  {participant.role === 'ADMIN' && (
                    <span className='ml-1.5 text-[10px] text-muted-foreground'>
                      admin
                    </span>
                  )}
                </span>
                <div className='flex shrink-0 items-center gap-1'>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon-sm'
                    aria-label={
                      participant.role === 'ADMIN'
                        ? 'Remover admin'
                        : 'Tornar admin'
                    }
                    disabled={setAdmin.isPending}
                    onClick={() =>
                      setAdmin.mutate({
                        waId: participant.waId,
                        admin: participant.role !== 'ADMIN',
                      })
                    }
                  >
                    <SteelIcon icon={ShieldUserIcon} size={14} />
                  </Button>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon-sm'
                    aria-label='Remover participante'
                    disabled={removeParticipants.isPending}
                    onClick={() =>
                      removeParticipants.mutate([participant.waId])
                    }
                  >
                    <SteelIcon icon={Delete02Icon} size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {availableContacts.length > 0 && (
            <div className='flex gap-2 pt-1'>
              <select
                className='h-9 flex-1 rounded-md border bg-background px-2 text-sm'
                value={newParticipant ?? ''}
                onChange={(event) =>
                  setNewParticipant(event.target.value || undefined)
                }
              >
                <option value=''>Selecione um contato</option>
                {availableContacts.map((contact) => (
                  <option key={contact.id} value={contact.waId}>
                    {contact.name ?? contact.waId}
                  </option>
                ))}
              </select>
              <Button
                type='button'
                variant='outline'
                size='icon-sm'
                disabled={!newParticipant || addParticipants.isPending}
                onClick={() => {
                  if (!newParticipant) return
                  addParticipants.mutate([newParticipant], {
                    onSuccess: () => setNewParticipant(undefined),
                  })
                }}
              >
                <SteelIcon icon={Add01Icon} size={14} />
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='destructive'
            disabled={leaveGroup.isPending}
            onClick={() => {
              if (!confirm('Sair deste grupo?')) return
              leaveGroup.mutate(group.id, {
                onSuccess: () => {
                  onOpenChange(false)
                  onLeft()
                },
                onError: (error) =>
                  notify.error(error, 'Erro ao sair do grupo'),
              })
            }}
          >
            Sair do grupo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function WhatsappGroupView({
  workspaceId,
  group,
  onLeft,
}: {
  workspaceId: string
  group: WhatsAppGroupDTO
  onLeft?: () => void
}) {
  const [text, setText] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)

  const messages = useWhatsAppGroupMessages(workspaceId, group.id)
  const sendText = useSendWhatsAppGroupTextMessage(workspaceId, group.id)

  function extractMentions(value: string): string[] {
    return group.participants
      .filter((p) => value.includes(`@${p.name ?? p.waId}`))
      .map((p) => p.waId)
  }

  async function handleSend() {
    const trimmed = text.trim()
    if (!trimmed) return
    try {
      await sendText.mutateAsync({
        text: trimmed,
        mentionedWaIds: extractMentions(trimmed),
      })
      setText('')
    } catch {
      notify.error('Erro ao enviar mensagem')
    }
  }

  return (
    <div className='flex h-full min-w-0 flex-1 flex-col'>
      <div className='flex items-center justify-between gap-3 border-b px-4 py-3'>
        <button
          type='button'
          className='flex items-center gap-2.5 text-left'
          onClick={() => setSettingsOpen(true)}
        >
          <Avatar>
            <AvatarImage src={group.imageUrl ?? undefined} />
            <AvatarFallback>
              {group.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className='font-medium text-sm'>{group.name}</p>
            <p className='text-muted-foreground text-xs'>
              {group.participants.length} participantes
            </p>
          </div>
        </button>
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          aria-label='Configurações do grupo'
          onClick={() => setSettingsOpen(true)}
        >
          <SteelIcon icon={Settings02Icon} size={18} />
        </Button>
      </div>

      <MessageScroller dependencyKey={messages.data?.length}>
        {(messages.data ?? []).map((message) => (
          <GroupMessageBubble key={message.id} message={message} />
        ))}
      </MessageScroller>

      <div className='flex items-end gap-1.5 border-t p-2'>
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              handleSend()
            }
          }}
          placeholder='Digite uma mensagem — use @nome para mencionar'
          disabled={sendText.isPending}
          className='max-h-32 min-h-9 flex-1 resize-none'
          rows={1}
        />
        <Button
          type='button'
          size='icon-sm'
          disabled={sendText.isPending || !text.trim()}
          aria-label='Enviar'
          onClick={handleSend}
        >
          <SteelIcon icon={SentIcon} size={16} />
        </Button>
      </div>

      <GroupSettingsDialog
        workspaceId={workspaceId}
        group={group}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onLeft={() => onLeft?.()}
      />
    </div>
  )
}
