'use client'

import {
  AiMagicIcon,
  BookOpen01Icon,
  Copy01Icon,
  Message01Icon,
  SentIcon,
  Tag01Icon,
  TextAlignLeftIcon,
  Tick02Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { type ReactNode, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  sdAiErrorHint,
  useResetSdAiChat,
  useSdAiChat,
  useSdAiClassification,
  useSdAiSolution,
  useSdAiSuggestReply,
  useSdAiSummary,
  useSendSdAiChat,
} from '@/src/hooks/use-sd-ai'
import {
  useLinkSdKbArticle,
  useSdKbSuggestions,
} from '@/src/hooks/use-sd-knowledge'
import { useUpdateSdTicket } from '@/src/hooks/use-sd-tickets'
import type { SdAiClassificationDTO, SdAiTextDTO } from '@/types/sd-ai'
import type { SdTicketDTO } from '@/types/sd-ticket'

import { SD_TONE } from '../sd-tone'

/**
 * Copiloto de IA na barra lateral do chamado: resume, sugere a próxima
 * resposta, classifica (com "aplicar" em 1 clique), rascunha a solução,
 * indica artigos da base e responde perguntas livres sobre o chamado.
 *
 * Tudo é sob demanda — nenhuma chamada ao provedor acontece sozinha, já que
 * cada uma consome a cota de IA do workspace (ADR 0007).
 */

type ResultKind = 'summary' | 'reply' | 'solution'

const RESULT_LABEL: Record<ResultKind, string> = {
  summary: 'Resumo do chamado',
  reply: 'Sugestão de resposta',
  solution: 'Rascunho da solução',
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    notify.success('Copiado')
  } catch {
    notify.error('Não foi possível copiar')
  }
}

function TextResult({
  kind,
  text,
  onClose,
}: {
  kind: ResultKind
  text: string
  onClose: () => void
}) {
  return (
    <div className='flex flex-col gap-2 rounded-lg border border-border bg-card p-3'>
      <div className='flex items-center gap-2'>
        <span className='font-medium text-xs'>{RESULT_LABEL[kind]}</span>
        <div className='ml-auto flex items-center gap-1'>
          <Button
            size='icon-xs'
            variant='ghost'
            aria-label={`Copiar ${RESULT_LABEL[kind].toLowerCase()}`}
            onClick={() => void copy(text)}
          >
            <SteelIcon icon={Copy01Icon} strokeWidth={2} />
          </Button>
          <Button size='xs' variant='ghost' onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
      <p className='whitespace-pre-wrap text-sm'>{text}</p>
    </div>
  )
}

function SuggestionRow({
  label,
  value,
  current,
  onApply,
  pending,
}: {
  label: string
  value: { id: string; name: string } | null
  current: string | null
  onApply: () => void
  pending: boolean
}) {
  if (!value) return null
  const applied = current === value.id
  return (
    <div className='flex items-center gap-2 text-sm'>
      <span className='w-24 shrink-0 text-muted-foreground text-xs'>
        {label}
      </span>
      <span className='min-w-0 flex-1 truncate'>{value.name}</span>
      {applied ? (
        <Badge variant='outline' className={SD_TONE.emerald}>
          Aplicado
        </Badge>
      ) : (
        <Button
          size='xs'
          variant='outline'
          disabled={pending}
          onClick={onApply}
        >
          Aplicar
        </Button>
      )}
    </div>
  )
}

function Classification({
  suggestions,
  ticket,
  workspaceId,
  onClose,
}: {
  suggestions: SdAiClassificationDTO
  ticket: SdTicketDTO
  workspaceId: string
  onClose: () => void
}) {
  const update = useUpdateSdTicket(workspaceId, ticket.id)
  const pending = update.isPending

  function apply(data: Parameters<typeof update.mutate>[0], message: string) {
    update.mutate(data, {
      onSuccess: () => notify.success(message),
      onError: (error) => notify.error(error),
    })
  }

  const everything = {
    ...(suggestions.category ? { categoryId: suggestions.category.id } : {}),
    ...(suggestions.subcategory
      ? { subcategoryId: suggestions.subcategory.id }
      : {}),
    ...(suggestions.service ? { serviceId: suggestions.service.id } : {}),
    ...(suggestions.impact ? { impactId: suggestions.impact.id } : {}),
    ...(suggestions.urgency ? { urgencyId: suggestions.urgency.id } : {}),
    ...(suggestions.priority ? { priorityId: suggestions.priority.id } : {}),
    ...(suggestions.department
      ? { departmentId: suggestions.department.id }
      : {}),
    ...(suggestions.tags.length > 0 ? { tags: suggestions.tags } : {}),
  }

  return (
    <div className='flex flex-col gap-2 rounded-lg border border-border bg-card p-3'>
      <div className='flex items-center gap-2'>
        <span className='font-medium text-xs'>Classificação sugerida</span>
        <Badge variant='secondary' className='tabular-nums'>
          {Math.round(suggestions.confidence * 100)}% de confiança
        </Badge>
        <Button size='xs' variant='ghost' className='ml-auto' onClick={onClose}>
          Fechar
        </Button>
      </div>

      <SuggestionRow
        label='Categoria'
        value={suggestions.category}
        current={ticket.category?.id ?? null}
        pending={pending}
        onApply={() =>
          apply(
            {
              categoryId: suggestions.category?.id,
              subcategoryId: suggestions.subcategory?.id,
              serviceId: suggestions.service?.id,
            },
            'Categoria aplicada',
          )
        }
      />
      <SuggestionRow
        label='Subcategoria'
        value={suggestions.subcategory}
        current={ticket.subcategory?.id ?? null}
        pending={pending}
        onApply={() =>
          apply(
            {
              categoryId: suggestions.category?.id,
              subcategoryId: suggestions.subcategory?.id,
            },
            'Subcategoria aplicada',
          )
        }
      />
      <SuggestionRow
        label='Serviço'
        value={suggestions.service}
        current={ticket.service?.id ?? null}
        pending={pending}
        onApply={() =>
          apply(
            {
              categoryId: suggestions.category?.id,
              subcategoryId: suggestions.subcategory?.id,
              serviceId: suggestions.service?.id,
            },
            'Serviço aplicado',
          )
        }
      />
      <SuggestionRow
        label='Impacto'
        value={suggestions.impact}
        current={ticket.impact?.id ?? null}
        pending={pending}
        onApply={() =>
          apply({ impactId: suggestions.impact?.id }, 'Impacto aplicado')
        }
      />
      <SuggestionRow
        label='Urgência'
        value={suggestions.urgency}
        current={ticket.urgency?.id ?? null}
        pending={pending}
        onApply={() =>
          apply({ urgencyId: suggestions.urgency?.id }, 'Urgência aplicada')
        }
      />
      <SuggestionRow
        label='Prioridade'
        value={suggestions.priority}
        current={ticket.priority?.id ?? null}
        pending={pending}
        onApply={() =>
          apply({ priorityId: suggestions.priority?.id }, 'Prioridade aplicada')
        }
      />
      <SuggestionRow
        label='Departamento'
        value={suggestions.department}
        current={ticket.department?.id ?? null}
        pending={pending}
        onApply={() =>
          apply(
            { departmentId: suggestions.department?.id },
            'Departamento aplicado',
          )
        }
      />
      {suggestions.tags.length > 0 ? (
        <div className='flex items-center gap-2 text-sm'>
          <span className='w-24 shrink-0 text-muted-foreground text-xs'>
            Tags
          </span>
          <span className='flex min-w-0 flex-1 flex-wrap gap-1'>
            {suggestions.tags.map((tag) => (
              <Badge key={tag} variant='secondary' className='gap-1'>
                <SteelIcon icon={Tag01Icon} size={10} strokeWidth={2} />
                {tag}
              </Badge>
            ))}
          </span>
          <Button
            size='xs'
            variant='outline'
            disabled={pending}
            onClick={() => apply({ tags: suggestions.tags }, 'Tags aplicadas')}
          >
            Aplicar
          </Button>
        </div>
      ) : null}

      {suggestions.reasoning ? (
        <p className='text-muted-foreground text-xs'>{suggestions.reasoning}</p>
      ) : null}

      {Object.keys(everything).length > 0 ? (
        <Button
          size='sm'
          className='self-end'
          disabled={pending}
          onClick={() => apply(everything, 'Classificação aplicada')}
        >
          <SteelIcon icon={Tick02Icon} strokeWidth={2} />
          Aplicar tudo
        </Button>
      ) : null}
    </div>
  )
}

function KbSuggestions({
  workspaceId,
  ticketId,
}: {
  workspaceId: string
  ticketId: string
}) {
  const suggestions = useSdKbSuggestions(workspaceId, ticketId)
  const linkArticle = useLinkSdKbArticle(workspaceId, ticketId)
  const items = suggestions.data ?? []

  if (suggestions.isLoading) return <Skeleton className='h-16 w-full' />
  if (items.length === 0) {
    return (
      <p className='text-muted-foreground text-xs'>
        Nenhum artigo da base combina com este chamado.
      </p>
    )
  }
  return (
    <ul className='flex flex-col gap-1.5'>
      {items.map((article) => (
        <li
          key={article.id}
          className='flex items-start gap-2 rounded-lg border border-border bg-card px-2.5 py-2'
        >
          <div className='flex min-w-0 flex-1 flex-col'>
            <span className='truncate font-medium text-sm'>
              {article.title}
            </span>
            <span className='line-clamp-2 text-muted-foreground text-xs'>
              {article.excerpt}
            </span>
          </div>
          <Button
            size='xs'
            variant='outline'
            disabled={linkArticle.isPending}
            onClick={() =>
              linkArticle.mutate(article.id, {
                onSuccess: () => notify.success('Artigo vinculado ao chamado'),
                onError: (error) => notify.error(error),
              })
            }
          >
            Vincular
          </Button>
        </li>
      ))}
    </ul>
  )
}

function Chat({
  workspaceId,
  ticketRef,
}: {
  workspaceId: string
  ticketRef: string
}) {
  const [message, setMessage] = useState('')
  const chat = useSdAiChat(workspaceId, ticketRef)
  const send = useSendSdAiChat(workspaceId, ticketRef)
  const reset = useResetSdAiChat(workspaceId, ticketRef)
  const messages = chat.data?.messages ?? []

  function submit() {
    const text = message.trim()
    if (!text) return
    send.mutate(text, {
      onSuccess: () => setMessage(''),
      onError: (error) => notify.error(error),
    })
  }

  return (
    <div className='flex flex-col gap-2'>
      {messages.length > 0 ? (
        <>
          <ul className='flex max-h-64 flex-col gap-2 overflow-y-auto'>
            {messages.map((item) => (
              <li
                key={`${item.role}-${item.at}`}
                className={cn(
                  'max-w-[92%] rounded-lg px-2.5 py-1.5 text-sm',
                  item.role === 'user'
                    ? 'self-end bg-primary text-primary-foreground'
                    : 'self-start bg-muted text-foreground',
                )}
              >
                <p className='whitespace-pre-wrap break-words'>
                  {item.content}
                </p>
              </li>
            ))}
          </ul>
          <Button
            size='xs'
            variant='ghost'
            className='self-start'
            disabled={reset.isPending}
            onClick={() =>
              reset.mutate(undefined, {
                onError: (error) => notify.error(error),
              })
            }
          >
            Limpar conversa
          </Button>
        </>
      ) : null}
      <form
        className='flex gap-1.5'
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <Input
          value={message}
          maxLength={4000}
          aria-label='Pergunta ao copiloto'
          placeholder='Pergunte sobre o chamado...'
          onChange={(event) => setMessage(event.target.value)}
        />
        <Button
          type='submit'
          size='icon'
          aria-label='Enviar pergunta ao copiloto'
          disabled={send.isPending || !message.trim()}
        >
          <SteelIcon icon={SentIcon} strokeWidth={2} />
        </Button>
      </form>
      {send.isPending ? (
        <p className='text-muted-foreground text-xs'>
          O copiloto está pensando...
        </p>
      ) : null}
    </div>
  )
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <Collapsible
      defaultOpen={false}
      className='rounded-lg border border-border'
    >
      <CollapsibleTrigger className='flex w-full items-center gap-2 px-2.5 py-2 text-left font-medium text-sm'>
        {icon}
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent className='flex flex-col gap-2 px-2.5 pb-2.5'>
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

export function SdAiCopilotPanel({
  workspaceId,
  ticket,
}: {
  workspaceId: string
  ticket: SdTicketDTO
}) {
  const ticketRef = ticket.id
  const summary = useSdAiSummary(workspaceId, ticketRef)
  const reply = useSdAiSuggestReply(workspaceId, ticketRef)
  const solution = useSdAiSolution(workspaceId, ticketRef)
  const classification = useSdAiClassification(workspaceId, ticketRef)
  const [result, setResult] = useState<{
    kind: ResultKind
    text: string
  } | null>(null)
  const [instructions, setInstructions] = useState('')
  const [showClassification, setShowClassification] = useState(false)

  const error =
    summary.error ?? reply.error ?? solution.error ?? classification.error
  const hint = sdAiErrorHint(error)
  const pending =
    summary.isPending ||
    reply.isPending ||
    solution.isPending ||
    classification.isPending

  /** Trata o erro no painel quando é acionável; o resto vira toast. */
  function onFailure(cause: unknown) {
    if (!sdAiErrorHint(cause)) notify.error(cause)
  }

  function onText(kind: ResultKind) {
    return {
      onSuccess: (data: SdAiTextDTO) => setResult({ kind, text: data.text }),
      onError: onFailure,
    }
  }

  return (
    <div className='flex flex-col gap-2'>
      {hint ? (
        <p className='rounded-lg bg-amber-500/10 px-2.5 py-2 text-amber-700 text-xs dark:text-amber-300'>
          {hint}
        </p>
      ) : null}

      <div className='flex flex-wrap gap-1.5'>
        <Button
          size='xs'
          variant='outline'
          disabled={pending}
          onClick={() => {
            setResult(null)
            summary.mutate(undefined, onText('summary'))
          }}
        >
          <SteelIcon icon={TextAlignLeftIcon} strokeWidth={2} />
          Resumir
        </Button>
        <Button
          size='xs'
          variant='outline'
          disabled={pending}
          onClick={() => {
            setResult(null)
            reply.mutate(
              { instructions: instructions.trim() || undefined },
              onText('reply'),
            )
          }}
        >
          <SteelIcon icon={Message01Icon} strokeWidth={2} />
          Sugerir resposta
        </Button>
        <Button
          size='xs'
          variant='outline'
          disabled={pending}
          onClick={() => {
            setResult(null)
            solution.mutate(undefined, onText('solution'))
          }}
        >
          <SteelIcon icon={AiMagicIcon} strokeWidth={2} />
          Rascunhar solução
        </Button>
        <Button
          size='xs'
          variant='outline'
          disabled={pending}
          onClick={() => {
            setShowClassification(true)
            classification.mutate(undefined, { onError: onFailure })
          }}
        >
          <SteelIcon icon={Tag01Icon} strokeWidth={2} />
          Classificar
        </Button>
      </div>

      <Input
        value={instructions}
        maxLength={1000}
        aria-label='Orientação para a sugestão de resposta'
        placeholder='Orientação opcional (ex.: peça o print do erro)'
        onChange={(event) => setInstructions(event.target.value)}
      />

      {pending ? (
        <p className='text-muted-foreground text-xs'>Consultando a IA...</p>
      ) : null}

      {result ? (
        <TextResult
          kind={result.kind}
          text={result.text}
          onClose={() => setResult(null)}
        />
      ) : null}

      {showClassification && classification.data ? (
        <Classification
          workspaceId={workspaceId}
          ticket={ticket}
          suggestions={classification.data}
          onClose={() => setShowClassification(false)}
        />
      ) : null}

      {ticket.aiSummary && !result ? (
        <div className='flex flex-col gap-1 rounded-lg bg-muted px-2.5 py-2'>
          <span className='font-medium text-muted-foreground text-xs'>
            Último resumo salvo
          </span>
          <p className='whitespace-pre-wrap text-sm'>{ticket.aiSummary}</p>
        </div>
      ) : null}

      <Panel
        title='Artigos da base'
        icon={
          <SteelIcon
            icon={BookOpen01Icon}
            strokeWidth={2}
            className='size-4 text-muted-foreground'
          />
        }
      >
        <KbSuggestions workspaceId={workspaceId} ticketId={ticketRef} />
      </Panel>

      <Panel
        title='Perguntar ao copiloto'
        icon={
          <SteelIcon
            icon={Message01Icon}
            strokeWidth={2}
            className='size-4 text-muted-foreground'
          />
        }
      >
        <Chat workspaceId={workspaceId} ticketRef={ticketRef} />
      </Panel>
    </div>
  )
}
