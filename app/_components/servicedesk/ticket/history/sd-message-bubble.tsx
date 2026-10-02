'use client'

import {
  Delete02Icon,
  PencilEdit02Icon,
  SparklesIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { SdTicketMailMessageDTO } from '@/types/sd-mailbox'
import type { SdTicketMessageDTO } from '@/types/sd-ticket-message'
import { SD_TONE, SD_TONE_SOFT, SD_TONE_TEXT } from '../sd-ticket-meta'
import { formatDateTime, formatTime } from '../shared/sd-tab-format'
import { SdMessageAttachments } from './sd-message-attachments'

/**
 * Nota interna: superfície âmbar discreta (o mesmo `/10` dos tons de
 * status), com o texto no token do tema para o corpo da mensagem continuar
 * legível no claro e no escuro.
 */
const INTERNAL_SURFACE = cn('border', SD_TONE_SOFT.amber, 'text-foreground')

const CHANNEL_LABEL: Record<SdTicketMessageDTO['channel'], string | null> = {
  PLATFORM: null,
  WHATSAPP: 'via WhatsApp',
  EMAIL: 'via e-mail',
}

export function sdMessageAuthorName(message: SdTicketMessageDTO): string {
  if (message.authorKind === 'SYSTEM') return 'Sistema'
  if (message.authorKind === 'AI')
    return message.author?.name ?? 'Assistente IA'
  return message.author?.name ?? message.contact?.name ?? 'Desconhecido'
}

/** Marcador das mensagens do canal de e-mail (de/para e assunto). */
function MailMarker({ mail }: { mail: SdTicketMailMessageDTO }) {
  const direction = mail.direction === 'INBOUND' ? 'De' : 'Para'
  const address =
    mail.direction === 'INBOUND'
      ? (mail.fromName ?? mail.fromAddress)
      : mail.toAddresses.join(', ')
  return (
    <div
      className={cn(
        'mb-1 flex flex-col gap-0.5 rounded-md px-2 py-1 text-[11px]',
        SD_TONE.sky,
      )}
      data-testid='sd-message-mail'
    >
      <span>
        <span className='font-medium'>{direction}:</span> {address || '—'}
      </span>
      {mail.subject ? (
        <span className='truncate'>
          <span className='font-medium'>Assunto:</span> {mail.subject}
        </span>
      ) : null}
      {mail.automatic ? (
        <span className='font-medium'>Mensagem automática</span>
      ) : null}
    </div>
  )
}

/**
 * Uma mensagem do histórico. Agente à direita (cor primária), solicitante e
 * contato à esquerda, IA com selo, sistema centralizado; nota interna em
 * amarelo. Mensagens do canal de e-mail ganham o marcador de/para e
 * assunto (`mail`, da fatia do canal de e-mail).
 */
export function SdMessageBubble({
  message,
  mail,
  onEdit,
  onDelete,
  pending,
}: {
  message: SdTicketMessageDTO
  mail?: SdTicketMailMessageDTO | null
  onEdit: (body: string) => Promise<unknown>
  onDelete: () => void
  pending?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.body)

  if (message.authorKind === 'SYSTEM') {
    return (
      <div className='flex justify-center' data-testid='sd-message-system'>
        <div className='max-w-[85%] rounded-md bg-muted px-3 py-1.5 text-center text-muted-foreground text-xs'>
          <span className='whitespace-pre-wrap'>{message.body}</span>
          <span className='ml-2 opacity-70'>
            {formatTime(message.createdAt)}
          </span>
          {message.visibility === 'INTERNAL' ? (
            <span className={cn('ml-2 font-medium', SD_TONE_TEXT.amber)}>
              · Nota interna
            </span>
          ) : null}
        </div>
      </div>
    )
  }

  const outgoing = message.authorKind === 'AGENT'
  const internal = message.visibility === 'INTERNAL'
  const channel = CHANNEL_LABEL[message.channel]

  async function save() {
    const body = draft.trim()
    if (!body || body === message.body) {
      setEditing(false)
      return
    }
    await onEdit(body)
    setEditing(false)
  }

  return (
    <div
      className={cn(
        'group flex w-full',
        outgoing ? 'justify-end' : 'justify-start',
      )}
      data-testid='sd-message'
    >
      <div
        className={cn(
          'flex max-w-[80%] flex-col gap-1',
          outgoing ? 'items-end' : 'items-start',
        )}
      >
        <div className='flex items-center gap-1.5 text-muted-foreground text-xs'>
          <span className='font-medium text-foreground'>
            {sdMessageAuthorName(message)}
          </span>
          {message.authorKind === 'AI' ? (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium text-[10px]',
                SD_TONE.violet,
              )}
            >
              <SteelIcon icon={SparklesIcon} size={10} />
              IA
            </span>
          ) : null}
          {message.authorKind === 'CONTACT' ? <span>(contato)</span> : null}
          {channel ? <span>{channel}</span> : null}
          <span title={formatDateTime(message.createdAt)}>
            {formatTime(message.createdAt)}
          </span>
          {message.editedAt ? <span>(editado)</span> : null}
        </div>

        <div
          className={cn(
            'rounded-lg px-3 py-2 text-sm',
            internal
              ? INTERNAL_SURFACE
              : outgoing
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground',
          )}
        >
          {internal ? (
            <div
              className={cn(
                'mb-1 font-semibold text-[11px] uppercase tracking-wide',
                SD_TONE_TEXT.amber,
              )}
            >
              Nota interna
            </div>
          ) : null}
          {mail ? <MailMarker mail={mail} /> : null}
          {editing ? (
            <div className='flex min-w-64 flex-col gap-2'>
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                aria-label='Editar mensagem'
                className='bg-background text-foreground'
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void save()
                  }
                  if (e.key === 'Escape') setEditing(false)
                }}
              />
              <div className='flex justify-end gap-1.5'>
                <Button
                  size='xs'
                  variant='ghost'
                  onClick={() => {
                    setDraft(message.body)
                    setEditing(false)
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  size='xs'
                  onClick={() => void save()}
                  disabled={pending}
                >
                  Salvar
                </Button>
              </div>
            </div>
          ) : message.body ? (
            <p className='whitespace-pre-wrap break-words'>{message.body}</p>
          ) : null}
          <SdMessageAttachments
            attachments={message.attachments}
            className={message.body ? 'mt-2' : undefined}
          />
        </div>

        {message.canEdit && !editing ? (
          <div className='flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100'>
            {message.body ? (
              <Button
                size='icon-xs'
                variant='ghost'
                aria-label='Editar mensagem'
                onClick={() => {
                  setDraft(message.body)
                  setEditing(true)
                }}
              >
                <SteelIcon icon={PencilEdit02Icon} />
              </Button>
            ) : null}
            <Button
              size='icon-xs'
              variant='ghost'
              aria-label='Excluir mensagem'
              className='hover:text-destructive'
              disabled={pending}
              onClick={onDelete}
            >
              <SteelIcon icon={Delete02Icon} />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
