'use client'

import {
  ArrowLeft01Icon,
  Attachment01Icon,
  Cancel01Icon,
  SentIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  useReplySdPortalTicket,
  useSdPortalTicket,
} from '@/src/hooks/use-sd-external-portal'
import { SD_PORTAL_MAX_ATTACHMENTS } from '@/src/schemas/sd-portal.schema'
import type { SdPortalMessageDTO } from '@/types/sd-portal'
import { SdRichTextView } from '../ticket/sd-rich-text-editor'
import {
  SdPhaseBadge,
  SdProgressBar,
  SdTypeBadge,
} from '../ticket/sd-ticket-badges'
import {
  SD_PHASE_CATEGORY_LABEL,
  sdFormatDateTime,
} from '../ticket/sd-ticket-meta'
import { SdExtCsat } from './sd-ext-csat'

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex min-w-0 flex-col gap-0.5'>
      <dt className='text-muted-foreground text-xs'>{label}</dt>
      <dd className='truncate font-medium text-sm'>{value}</dd>
    </div>
  )
}

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Uma mensagem do histórico, no tom de conversa. */
function Message({ message }: { message: SdPortalMessageDTO }) {
  return (
    <li
      className={cn(
        'flex flex-col gap-1.5 rounded-xl border p-3',
        message.mine
          ? 'ml-auto max-w-[90%] border-blue-500/20 bg-blue-500/10'
          : 'mr-auto max-w-[90%] border-border bg-card',
      )}
    >
      <div className='flex items-center gap-2'>
        <span className='font-medium text-xs'>{message.authorName}</span>
        <span className='text-muted-foreground text-[11px]'>
          {sdFormatDateTime(message.createdAt)}
        </span>
      </div>
      {message.body ? (
        <p className='whitespace-pre-wrap break-words text-sm'>
          {message.body}
        </p>
      ) : null}
      {message.attachments.length > 0 ? (
        <ul className='flex flex-col gap-1'>
          {message.attachments.map((file) => (
            <li key={file.id}>
              <a
                href={`${file.url}?download=1`}
                className='flex items-center gap-1.5 text-blue-700 text-xs underline dark:text-blue-300'
              >
                <SteelIcon
                  icon={Attachment01Icon}
                  strokeWidth={2}
                  className='size-3.5'
                />
                {file.fileName}
                <span className='text-muted-foreground'>
                  ({fileSize(file.size)})
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}

/** Caixa de resposta do contato (texto + até 5 anexos). */
function ReplyBox({ code }: { code: string }) {
  const reply = useReplySdPortalTicket(code)
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)

  function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? [])
    setFiles((current) =>
      [...current, ...picked].slice(0, SD_PORTAL_MAX_ATTACHMENTS),
    )
    event.target.value = ''
  }

  async function send() {
    const body = text.trim()
    if (!body && files.length === 0) return
    setError(null)
    try {
      await reply.mutateAsync({ body, files })
      setText('')
      setFiles([])
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não conseguimos enviar sua mensagem',
      )
    }
  }

  return (
    <div className='flex flex-col gap-2 border-border border-t p-3'>
      <Textarea
        rows={3}
        maxLength={10_000}
        value={text}
        aria-label='Sua mensagem'
        placeholder='Escreva para a equipe de atendimento…'
        onChange={(event) => setText(event.target.value)}
      />
      {files.length > 0 ? (
        <ul className='flex flex-wrap gap-1.5'>
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className='flex items-center gap-1 rounded-lg border border-border bg-muted/40 px-2 py-1 text-xs'
            >
              {file.name}
              <button
                type='button'
                aria-label={`Remover ${file.name}`}
                onClick={() =>
                  setFiles((current) =>
                    current.filter((_, position) => position !== index),
                  )
                }
                className='text-muted-foreground hover:text-foreground'
              >
                <SteelIcon
                  icon={Cancel01Icon}
                  strokeWidth={2}
                  className='size-3'
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p role='alert' className='text-red-700 text-xs dark:text-red-300'>
          {error}
        </p>
      ) : null}
      <div className='flex items-center justify-between gap-2'>
        <input ref={inputRef} type='file' multiple hidden onChange={pick} />
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={files.length >= SD_PORTAL_MAX_ATTACHMENTS}
          onClick={() => inputRef.current?.click()}
        >
          <SteelIcon icon={Attachment01Icon} strokeWidth={2} />
          Anexar
        </Button>
        <Button
          type='button'
          disabled={reply.isPending || (!text.trim() && files.length === 0)}
          onClick={() => void send()}
        >
          <SteelIcon icon={SentIcon} strokeWidth={2} />
          {reply.isPending ? 'Enviando…' : 'Enviar'}
        </Button>
      </div>
    </div>
  )
}

/**
 * `/suporte/chamados/[code]`: a situação do chamado com a barra de
 * progresso da fase, as informações que interessam a quem pediu, a conversa
 * com a equipe (só o que é público), a resposta com anexo e a avaliação.
 */
export function SdExtTicket({ code }: { code: string }) {
  const query = useSdPortalTicket(code)
  const ticket = query.data

  if (query.isError) {
    return (
      <div className='flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-10 text-center'>
        <p className='font-medium text-sm'>Não encontramos este chamado</p>
        <p className='max-w-md text-muted-foreground text-xs'>
          {query.error.message}
        </p>
        <Link
          href='/suporte/chamados'
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Voltar aos meus chamados
        </Link>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className='flex flex-col gap-3'>
        <Skeleton className='h-28 rounded-2xl' />
        <Skeleton className='h-64 rounded-2xl' />
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-5'>
      <header className='flex flex-col gap-3 rounded-2xl border border-border bg-card p-5'>
        <div className='flex flex-wrap items-center gap-2'>
          <Link
            href='/suporte/chamados'
            aria-label='Voltar aos meus chamados'
            className={buttonVariants({ variant: 'ghost', size: 'icon-xs' })}
          >
            <SteelIcon icon={ArrowLeft01Icon} strokeWidth={2} />
          </Link>
          <span className='font-mono text-muted-foreground text-xs'>
            {ticket.code}
          </span>
          <SdTypeBadge type={ticket.type} />
          <SdPhaseBadge phase={ticket.phase} />
        </div>
        <h1 className='font-semibold text-lg'>{ticket.title}</h1>
        <div className='flex items-center gap-3'>
          <SdProgressBar
            percent={ticket.completionPercent}
            color={ticket.phase.color}
            className='w-full'
          />
          <span className='shrink-0 text-muted-foreground text-xs tabular-nums'>
            {ticket.completionPercent}%
          </span>
        </div>
        <p className='text-muted-foreground text-xs'>
          Situação: {SD_PHASE_CATEGORY_LABEL[ticket.phase.category]} · aberto em{' '}
          {sdFormatDateTime(ticket.createdAt)}
        </p>
      </header>

      <dl className='grid gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2 lg:grid-cols-4'>
        <Info label='Assunto' value={ticket.subject ?? 'Não informado'} />
        <Info
          label='Quem está atendendo'
          value={ticket.assigneeName ?? 'Aguardando a equipe'}
        />
        <Info label='Urgência' value={ticket.urgencyName ?? 'Não informada'} />
        <Info label='Empresa' value={ticket.companyName ?? 'Não informada'} />
      </dl>

      {ticket.description ? (
        <section className='rounded-2xl border border-border bg-card p-5'>
          <h2 className='mb-2 font-medium text-sm'>O que você relatou</h2>
          <SdRichTextView html={ticket.description} className='text-sm' />
        </section>
      ) : null}

      {ticket.solution ? (
        <section className='rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5'>
          <h2 className='mb-2 font-medium text-emerald-700 text-sm dark:text-emerald-300'>
            Como foi resolvido
          </h2>
          <SdRichTextView html={ticket.solution} className='text-sm' />
        </section>
      ) : null}

      <SdExtCsat
        code={ticket.code}
        csatScore={ticket.csatScore}
        csatComment={ticket.csatComment}
        canRate={ticket.canRate}
      />

      <section className='flex flex-col overflow-hidden rounded-2xl border border-border bg-card'>
        <h2 className='border-border border-b px-5 py-3 font-medium text-sm'>
          Conversa com a equipe
        </h2>
        {ticket.messages.length === 0 ? (
          <p className='p-5 text-muted-foreground text-sm'>
            Ainda não há mensagens. Escreva abaixo se quiser acrescentar algo.
          </p>
        ) : (
          <ul className='flex flex-col gap-2 p-3'>
            {ticket.messages.map((message) => (
              <Message key={message.id} message={message} />
            ))}
          </ul>
        )}
        {ticket.canReply ? <ReplyBox code={ticket.code} /> : null}
      </section>
    </div>
  )
}
