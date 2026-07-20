'use client'

import { Add01Icon, Search01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { type FormEvent, useEffect, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import { useWhatsAppConnections } from '@/src/hooks/use-whatsapp-connections'
import { useWhatsAppContacts } from '@/src/hooks/use-whatsapp-contacts'
import {
  useStartWhatsAppConversation,
  useWhatsAppConversations,
} from '@/src/hooks/use-whatsapp-conversations'
import type { WhatsAppConversationDTO } from '@/types/whatsapp-conversation'

function NewConversationDialog({
  workspaceId,
  onCreated,
}: {
  workspaceId: string
  onCreated: (conversation: WhatsAppConversationDTO) => void
}) {
  const [open, setOpen] = useState(false)
  const [contactId, setContactId] = useState<string>()
  const [connectionId, setConnectionId] = useState<string>()

  const contacts = useWhatsAppContacts(workspaceId)
  const connections = useWhatsAppConnections(workspaceId)
  const startConversation = useStartWhatsAppConversation(workspaceId)

  useEffect(() => {
    if (!connectionId && connections.data?.length) {
      setConnectionId(connections.data[0].id)
    }
  }, [connections.data, connectionId])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!contactId || !connectionId) return

    startConversation.mutate(
      { contactId, connectionId },
      {
        onSuccess: (conversation) => {
          onCreated(conversation)
          setOpen(false)
          setContactId(undefined)
        },
        onError: (error) => notify.error(error, 'Erro ao iniciar conversa'),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size='icon-sm' variant='ghost' aria-label='Nova conversa'>
            <SteelIcon icon={Add01Icon} size={18} />
          </Button>
        }
      />
      <DialogContent className='max-w-sm'>
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='space-y-3'>
          <div className='space-y-1.5'>
            <Label htmlFor='newConvContact'>Contato</Label>
            <Select
              value={contactId}
              onValueChange={(value) => setContactId(value ?? undefined)}
            >
              <SelectTrigger id='newConvContact' className='w-full'>
                <SelectValue placeholder='Selecione um contato' />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                  {(contacts.data ?? []).map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.name ?? contact.waId}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {contacts.data?.length === 0 && (
              <p className='text-muted-foreground text-xs'>
                Cadastre um contato em Configurações primeiro.
              </p>
            )}
          </div>

          {connections.data && connections.data.length > 1 && (
            <div className='space-y-1.5'>
              <Label htmlFor='newConvConnection'>Enviar por</Label>
              <Select
                value={connectionId}
                onValueChange={(value) => setConnectionId(value ?? undefined)}
              >
                <SelectTrigger id='newConvConnection' className='w-full'>
                  <SelectValue placeholder='Selecione a conexão' />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {connections.data.map((connection) => (
                      <SelectItem key={connection.id} value={connection.id}>
                        {connection.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button
              type='submit'
              disabled={
                !contactId || !connectionId || startConversation.isPending
              }
            >
              {startConversation.isPending
                ? 'Iniciando...'
                : 'Iniciar conversa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function WhatsappConversationSidebar({
  workspaceId,
  selectedConversationId,
  onSelect,
}: {
  workspaceId: string
  selectedConversationId: string | null
  onSelect: (conversation: WhatsAppConversationDTO) => void
}) {
  const [search, setSearch] = useState('')
  const conversations = useWhatsAppConversations(workspaceId)

  const filtered = (conversations.data ?? []).filter((conversation) => {
    if (!search) return true
    const term = search.toLowerCase()
    return (
      conversation.contactName?.toLowerCase().includes(term) ||
      conversation.contactWaId.includes(term)
    )
  })

  return (
    <div className='flex h-full w-80 shrink-0 flex-col border-r'>
      <div className='flex items-center gap-2 p-3'>
        <div className='relative flex-1'>
          <SteelIcon
            icon={Search01Icon}
            size={16}
            className='-translate-y-1/2 absolute top-1/2 left-2.5 text-muted-foreground'
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder='Buscar conversa'
            className='pl-8'
          />
        </div>
        <NewConversationDialog workspaceId={workspaceId} onCreated={onSelect} />
      </div>
      <div className='flex-1 overflow-y-auto'>
        {filtered.length === 0 ? (
          <p className='px-3 py-6 text-center text-muted-foreground text-sm'>
            Nenhuma conversa
          </p>
        ) : (
          filtered.map((conversation) => (
            <button
              key={conversation.id}
              type='button'
              onClick={() => onSelect(conversation)}
              className={cn(
                'flex w-full items-center gap-2.5 border-b px-3 py-2.5 text-left hover:bg-muted',
                selectedConversationId === conversation.id && 'bg-muted',
              )}
            >
              <Avatar>
                <AvatarImage src={conversation.contactAvatarUrl ?? undefined} />
                <AvatarFallback>
                  {(conversation.contactName ?? conversation.contactWaId)
                    .slice(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className='min-w-0 flex-1'>
                <div className='flex items-center justify-between gap-2'>
                  <span className='truncate font-medium text-sm'>
                    {conversation.contactName ?? conversation.contactWaId}
                  </span>
                  <span className='shrink-0 text-[10px] text-muted-foreground'>
                    {formatRelativeTime(conversation.lastMessageAt)}
                  </span>
                </div>
                <div className='flex items-center justify-between gap-2'>
                  <span className='truncate text-muted-foreground text-xs'>
                    {conversation.lastMessagePreview ?? 'Sem mensagens'}
                  </span>
                  {conversation.unreadCount > 0 && (
                    <Badge className='shrink-0'>
                      {conversation.unreadCount}
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
