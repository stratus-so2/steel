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
import { SD_TONE_BORDER, SD_TONE_TEXT } from '../../sd-tone'
import { SdUserAvatar } from '../sd-ticket-badges'
import { formatDateTime, formatTime } from '../shared/sd-tab-format'
import { SdMessageAttachments } from './sd-message-attachments'

/**
 * Nota interna: só um filete âmbar à esquerda e o rótulo em âmbar — sem
 * fundo colorido; o corpo fica no token do tema.
 */
const INTERNAL_RULE = cn('border-l-2 pl-3', SD_TONE_BORDER.amber)

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
      className='mb-1 flex flex-col gap-0.5 text-muted-foreground text-xs'
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
 * Uma entrada da conversa, em linha do tempo: avatar, autor e hora em cima,
 * texto corrido embaixo — sem balões coloridos. IA com selo, sistema numa
 * linha centralizada e discreta; nota interna com filete e rótulo âmbar.
 * Mensagens do canal de e-mail ganham o marcador de/para e assunto (`mail`,
 * da fatia do canal de e-mail).
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
      <div
        className='flex justify-center px-2 py-0.5'
        data-testid='sd-message-system'
      >
        <div className='max-w-[85%] text-center text-muted-foreground text-xs'>
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

  const avatar =
    message.author ??
    (message.contact ? { name: message.contact.name, image: null } : null)

  return (
    <article
      className='group flex w-full gap-3'
      data-testid='sd-message'
      data-internal={internal || undefined}
      aria-label={`${sdMessageAuthorName(message)}${internal ? ' — nota interna' : ''}`}
    >
      <SdUserAvatar
        user={avatar ?? { name: sdMessageAuthorName(message), image: null }}
        className='mt-0.5 size-7 shrink-0'
      />
      <div className='flex min-w-0 flex-1 flex-col gap-1'>
        <div className='flex min-h-6 flex-wrap items-center gap-x-1.5 text-muted-foreground text-xs'>
          <span className='font-medium text-foreground text-sm'>
            {sdMessageAuthorName(message)}
          </span>
          {message.authorKind === 'AI' ? (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-medium',
                SD_TONE_TEXT.violet,
              )}
            >
              <SteelIcon icon={SparklesIcon} size={10} />
              IA
            </span>
          ) : null}
          {message.authorKind === 'CONTACT' ? <span>(contato)</span> : null}
          {internal ? (
            <span className={cn('font-medium', SD_TONE_TEXT.amber)}>
              Nota interna
            </span>
          ) : null}
          {channel ? <span>{channel}</span> : null}
          <span title={formatDateTime(message.createdAt)}>
            {formatTime(message.createdAt)}
          </span>
          {message.editedAt ? <span>(editado)</span> : null}

          {message.canEdit && !editing ? (
            <span className='ml-auto flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100'>
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
            </span>
          ) : null}
        </div>

        <div className={cn('text-sm', internal && INTERNAL_RULE)}>
          {mail ? <MailMarker mail={mail} /> : null}
          {editing ? (
            <div className='flex flex-col gap-2'>
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                aria-label='Editar mensagem'
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
            <p className='whitespace-pre-wrap break-words leading-relaxed'>
              {message.body}
            </p>
          ) : null}
          <SdMessageAttachments
            attachments={message.attachments}
            className={message.body ? 'mt-2' : undefined}
          />
        </div>
      </div>
    </article>
  )
}
