'use client'

import { Ticket01Icon } from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import type { SdLinkedTicketDTO } from '@/types/sd-directory'
import {
  formatSdDate,
  SD_ACTIVE_LABEL,
  SD_ACTIVE_TONE,
  SD_STATE_TONE,
  SD_TICKET_PREFIX,
  SD_TICKET_TYPE_LABEL,
} from './sd-directory-labels'

/** Pílula colorida simples (status, criticidade, tipo). */
export function SdPill({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 font-medium text-xs',
        className,
      )}
    >
      {children}
    </span>
  )
}

const PHASE_TONE: Record<SdLinkedTicketDTO['phaseCategory'], string> = {
  NEW: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  IN_PROGRESS: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  WAITING: SD_STATE_TONE.warn,
  RESOLVED: SD_STATE_TONE.ok,
  CLOSED: SD_STATE_TONE.neutral,
  CANCELED: `${SD_STATE_TONE.neutral} line-through`,
}

/** Pílula "Ativo/Inativo" dos cadastros (clientes, empresas, contatos). */
export function SdActivePill({ active }: { active: boolean }) {
  const key = active ? 'ACTIVE' : 'INACTIVE'
  return <SdPill className={SD_ACTIVE_TONE[key]}>{SD_ACTIVE_LABEL[key]}</SdPill>
}

/** Aba "Chamados" dos cadastros: últimos chamados vinculados. */
export function SdLinkedTickets({
  slug,
  tickets,
}: {
  slug: string
  tickets: SdLinkedTicketDTO[]
}) {
  if (tickets.length === 0) {
    return (
      <div className='flex min-h-48 flex-col items-center justify-center gap-3 py-10 text-center'>
        <div className='flex size-12 items-center justify-center rounded-2xl border border-border/70 bg-muted/40 text-muted-foreground'>
          <SteelIcon icon={Ticket01Icon} strokeWidth={1.8} className='size-5' />
        </div>
        <p className='font-medium text-sm'>Nenhum chamado vinculado</p>
        <p className='text-muted-foreground text-xs'>
          Os chamados abertos para este cadastro aparecem aqui.
        </p>
      </div>
    )
  }
  return (
    <ul className='divide-y divide-border rounded-lg border border-border'>
      {tickets.map((t) => (
        <li key={t.id}>
          <Link
            href={`/${slug}/servicedesk/tickets/${t.number}`}
            className='flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/50'
          >
            <span className='w-20 shrink-0 font-mono text-muted-foreground text-xs'>
              {SD_TICKET_PREFIX[t.type]}-{t.number}
            </span>
            <span className='min-w-0 flex-1 truncate' title={t.title}>
              {t.title}
            </span>
            <SdPill className={PHASE_TONE[t.phaseCategory]}>
              {t.phaseName}
            </SdPill>
            <span
              className='hidden w-20 shrink-0 text-right text-muted-foreground text-xs sm:block'
              title={SD_TICKET_TYPE_LABEL[t.type]}
            >
              {formatSdDate(t.createdAt)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** Garantia: vencida, vencendo (≤ 30 dias) ou em dia. */
export function SdWarrantyBadge({ until }: { until: string | null }) {
  if (!until) return <span className='text-muted-foreground'>—</span>
  const days = Math.ceil(
    (new Date(until).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  )
  const tone =
    days < 0
      ? SD_STATE_TONE.bad
      : days <= 30
        ? SD_STATE_TONE.warn
        : SD_STATE_TONE.ok
  const label =
    days < 0
      ? `Vencida em ${formatSdDate(until)}`
      : days <= 30
        ? `Vence em ${days} dia${days === 1 ? '' : 's'}`
        : `Até ${formatSdDate(until)}`
  return <SdPill className={tone}>{label}</SdPill>
}

/** Confirmação de exclusão (texto pt-BR, ação destrutiva). */
export function SdConfirmDelete({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  onConfirm: () => Promise<void> | void
}) {
  const [busy, setBusy] = useState(false)
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant='destructive'
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onConfirm()
                onOpenChange(false)
              } finally {
                setBusy(false)
              }
            }}
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
