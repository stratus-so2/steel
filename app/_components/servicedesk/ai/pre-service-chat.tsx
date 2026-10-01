'use client'

import {
  AiMagicIcon,
  BookOpen01Icon,
  CheckmarkCircle02Icon,
  SentIcon,
  TicketStarIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  sdAiErrorHint,
  useSdPreServiceClose,
  useSdPreServiceMessage,
  useSdPreServiceOpenTicket,
} from '@/src/hooks/use-sd-ai'
import type {
  SdAiArticleCardDTO,
  SdAiMessageDTO,
  SdAiOpenedTicketDTO,
} from '@/types/sd-ai'

/**
 * Pré-atendimento por IA no portal do solicitante: conversa, cartões de
 * artigos da base e o botão "abrir chamado" com o rascunho que a IA montou
 * (título, descrição, tipo e catálogo já preenchidos no servidor).
 */

const WELCOME =
  'Olá! Conte o que está acontecendo que eu tento resolver na hora — se precisar, abro um chamado para o time de atendimento.'

function ArticleCard({
  article,
  slug,
}: {
  article: SdAiArticleCardDTO
  slug: string
}) {
  return (
    <Link
      href={`/${slug}/servicedesk/knowledge/${article.id}`}
      className='flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:bg-muted'
    >
      <SteelIcon
        icon={BookOpen01Icon}
        strokeWidth={2}
        className='mt-0.5 size-4 shrink-0 text-muted-foreground'
      />
      <span className='flex min-w-0 flex-col'>
        <span className='truncate font-medium text-sm'>{article.title}</span>
        <span className='line-clamp-2 text-muted-foreground text-xs'>
          {article.excerpt}
        </span>
      </span>
    </Link>
  )
}

function Bubble({ message, slug }: { message: SdAiMessageDTO; slug: string }) {
  const mine = message.role === 'user'
  return (
    <li
      className={cn(
        'flex max-w-[85%] flex-col gap-2',
        mine ? 'self-end items-end' : 'self-start items-start',
      )}
    >
      <div
        className={cn(
          'rounded-2xl px-3 py-2 text-sm',
          mine
            ? 'rounded-br-sm bg-primary text-primary-foreground'
            : 'rounded-bl-sm bg-muted text-foreground',
        )}
      >
        <p className='whitespace-pre-wrap break-words'>{message.content}</p>
      </div>
      {message.articles?.length ? (
        <div className='flex w-full flex-col gap-1.5'>
          {message.articles.map((article) => (
            <ArticleCard key={article.id} article={article} slug={slug} />
          ))}
        </div>
      ) : null}
    </li>
  )
}

export function SdPreServiceChat({
  workspaceId,
  slug,
  onTicketCreated,
}: {
  workspaceId: string
  slug: string
  onTicketCreated?: (ticket: SdAiOpenedTicketDTO) => void
}) {
  const [messages, setMessages] = useState<SdAiMessageDTO[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [opened, setOpened] = useState<SdAiOpenedTicketDTO | null>(null)
  const [closed, setClosed] = useState(false)

  const send = useSdPreServiceMessage(workspaceId)
  const openTicket = useSdPreServiceOpenTicket(workspaceId)
  const close = useSdPreServiceClose(workspaceId)
  const hint = sdAiErrorHint(send.error)

  function submit() {
    const message = draft.trim()
    if (!message) return
    setMessages((current) => [
      ...current,
      { role: 'user', content: message, at: new Date().toISOString() },
    ])
    setDraft('')
    send.mutate(
      { message, ...(conversationId ? { conversationId } : {}) },
      {
        onSuccess: (data) => {
          setConversationId(data.conversation.id)
          setMessages(data.conversation.messages)
          setSuggestOpen(data.suggestOpenTicket)
        },
        onError: (error) => {
          if (!sdAiErrorHint(error)) notify.error(error)
        },
      },
    )
  }

  if (opened) {
    return (
      <div
        className='flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-5'
        data-testid='sd-pre-service-opened'
      >
        <div className='flex items-center gap-2'>
          <SteelIcon
            icon={CheckmarkCircle02Icon}
            strokeWidth={2}
            className='text-emerald-600 dark:text-emerald-400'
          />
          <h3 className='font-semibold text-sm'>
            Chamado {opened.code} aberto
          </h3>
        </div>
        <p className='text-muted-foreground text-sm'>
          Guardamos a conversa no chamado. Você pode acompanhar o andamento por
          aqui.
        </p>
        <Button
          size='sm'
          render={
            <Link href={`/${slug}/servicedesk/tickets/${opened.number}`}>
              Ver o chamado
            </Link>
          }
        />
      </div>
    )
  }

  if (closed) {
    return (
      <div className='flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-5'>
        <h3 className='font-semibold text-sm'>Que bom que ajudou!</h3>
        <p className='text-muted-foreground text-sm'>
          Se precisar de mais alguma coisa, é só começar uma nova conversa.
        </p>
        <Button
          size='sm'
          variant='outline'
          onClick={() => {
            setClosed(false)
            setMessages([])
            setConversationId(null)
            setSuggestOpen(false)
          }}
        >
          Começar de novo
        </Button>
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-3 rounded-xl border border-border bg-card p-4'>
      <header className='flex items-center gap-2'>
        <SteelIcon
          icon={AiMagicIcon}
          strokeWidth={2}
          className='size-4 text-violet-600 dark:text-violet-400'
        />
        <h3 className='font-semibold text-sm'>Assistente do ServiceDesk</h3>
      </header>

      {hint ? (
        <p className='rounded-lg bg-amber-500/10 px-3 py-2 text-amber-700 text-xs dark:text-amber-300'>
          {hint}
        </p>
      ) : null}

      <ul
        className='flex max-h-96 flex-col gap-3 overflow-y-auto'
        data-testid='sd-pre-service-messages'
      >
        {messages.length === 0 ? (
          <li className='max-w-[85%] self-start rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-foreground text-sm'>
            {WELCOME}
          </li>
        ) : (
          messages.map((message) => (
            <Bubble
              key={`${message.role}-${message.at}-${message.content.slice(0, 12)}`}
              message={message}
              slug={slug}
            />
          ))
        )}
        {send.isPending ? (
          <li className='self-start text-muted-foreground text-xs'>
            O assistente está digitando...
          </li>
        ) : null}
      </ul>

      <form
        className='flex gap-2'
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <Input
          value={draft}
          maxLength={4000}
          aria-label='Mensagem para o assistente'
          placeholder='Descreva o que está acontecendo...'
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button
          type='submit'
          size='icon'
          aria-label='Enviar mensagem'
          disabled={send.isPending || !draft.trim()}
        >
          <SteelIcon icon={SentIcon} strokeWidth={2} />
        </Button>
      </form>

      {conversationId ? (
        <div className='flex flex-wrap items-center gap-2'>
          <Button
            size='sm'
            variant={suggestOpen ? 'default' : 'outline'}
            disabled={openTicket.isPending}
            onClick={() =>
              openTicket.mutate(
                { conversationId },
                {
                  onSuccess: (ticket) => {
                    setOpened(ticket)
                    onTicketCreated?.(ticket)
                    notify.success(`Chamado ${ticket.code} aberto`)
                  },
                  onError: (error) => notify.error(error),
                },
              )
            }
          >
            <SteelIcon icon={TicketStarIcon} strokeWidth={2} />
            {openTicket.isPending ? 'Abrindo...' : 'Abrir chamado'}
          </Button>
          <Button
            size='sm'
            variant='ghost'
            disabled={close.isPending}
            onClick={() =>
              close.mutate(
                { conversationId, outcome: 'resolved_by_kb' },
                {
                  onSuccess: () => setClosed(true),
                  onError: (error) => notify.error(error),
                },
              )
            }
          >
            Resolvido, obrigado
          </Button>
        </div>
      ) : null}

      {suggestOpen ? (
        <p className='text-muted-foreground text-xs'>
          Posso abrir um chamado com o resumo desta conversa para o time de
          atendimento continuar.
        </p>
      ) : null}
    </div>
  )
}
