'use client'

import {
  Alert02Icon,
  ArrowRight02Icon,
  CancelCircleIcon,
  Clock01Icon,
  Loading03Icon,
  Tick02Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { useState } from 'react'
import { STEEL_AI_MODULE_META } from '@/app/_components/steel-ai/steel-ai-starters'
import { SteelIcon } from '@/components/icon/icon'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import { useDecideSteelAgentAction } from '@/src/hooks/use-steel-agents'
import type {
  AiActionKindDTO,
  AiPendingActionDTO,
  AiPendingActionStatusDTO,
} from '@/types/steel-ai'

const KIND_LABEL: Record<AiActionKindDTO, string> = {
  CREATE: 'Criar',
  UPDATE: 'Alterar',
  DELETE: 'Excluir',
  ACTION: 'Ação',
}

const OUTCOME: Record<
  Exclude<AiPendingActionStatusDTO, 'PENDING'>,
  { icon: typeof Tick02Icon; label: string; className: string }
> = {
  EXECUTED: {
    icon: Tick02Icon,
    label: 'Aprovada e executada',
    className: 'text-primary',
  },
  FAILED: {
    icon: Alert02Icon,
    label: 'Aprovada, mas falhou',
    className: 'text-destructive',
  },
  CANCELED: {
    icon: CancelCircleIcon,
    label: 'Rejeitada — nada foi alterado',
    className: 'text-muted-foreground',
  },
  EXPIRED: {
    icon: Clock01Icon,
    label: 'Expirou sem decisão — nada foi alterado',
    className: 'text-muted-foreground',
  },
}

/**
 * A write proposed by a Steel Agent, waiting for the owner or an admin.
 * Shows the preview (before → after); DELETE asks twice and sends
 * `doubleConfirmed: true`. The tool runs with the agent owner's permissions.
 */
export function SteelAgentApprovalCard({
  workspaceId,
  runId,
  action: initial,
  canApprove,
}: {
  workspaceId: string
  runId: string
  action: AiPendingActionDTO
  canApprove: boolean
}) {
  const [override, setOverride] = useState<AiPendingActionDTO | null>(null)
  const [askTwice, setAskTwice] = useState(false)
  const { approve, reject } = useDecideSteelAgentAction(workspaceId, runId)
  const action = override && initial.status === 'PENDING' ? override : initial
  const expired =
    action.status === 'PENDING' && Date.parse(action.expiresAt) <= Date.now()
  const status: AiPendingActionStatusDTO = expired ? 'EXPIRED' : action.status
  const busy = approve.isPending || reject.isPending
  const isDelete = action.kind === 'DELETE' || action.requiresDoubleConfirm
  const { preview } = action
  const moduleMeta = action.module ? STEEL_AI_MODULE_META[action.module] : null
  const outcome = status === 'PENDING' ? null : OUTCOME[status]

  async function doApprove(doubleConfirmed: boolean) {
    try {
      setOverride(
        await approve.mutateAsync({
          actionId: action.id,
          ...(doubleConfirmed && { doubleConfirmed: true }),
        }),
      )
      setAskTwice(false)
      notify.success('Ação aprovada.')
    } catch (error) {
      setAskTwice(false)
      notify.error(error)
    }
  }

  async function doReject() {
    try {
      setOverride(await reject.mutateAsync(action.id))
      notify.success('Ação rejeitada.')
    } catch (error) {
      notify.error(error)
    }
  }

  return (
    <article
      aria-label={`Ação proposta: ${preview.title}`}
      data-status={status}
      className={cn(
        'w-full space-y-3 rounded-xl border bg-card p-4 text-card-foreground shadow-xs',
        isDelete && status === 'PENDING'
          ? 'border-destructive/40'
          : 'border-border',
      )}
    >
      <header className='space-y-1.5'>
        <div className='flex flex-wrap items-center gap-1.5'>
          <Badge
            variant={action.kind === 'DELETE' ? 'destructive' : 'secondary'}
          >
            {KIND_LABEL[action.kind]}
          </Badge>
          {moduleMeta ? (
            <Badge variant='outline'>
              <SteelIcon icon={moduleMeta.icon} strokeWidth={2} />
              {moduleMeta.label}
            </Badge>
          ) : null}
          {status === 'PENDING' ? (
            <span className='text-muted-foreground text-xs'>
              Aguardando aprovação
            </span>
          ) : null}
        </div>
        <h3 className='font-semibold text-sm leading-snug'>{preview.title}</h3>
        {preview.summary ? (
          <p className='text-muted-foreground text-sm leading-relaxed'>
            {preview.summary}
          </p>
        ) : null}
      </header>

      {preview.fields && preview.fields.length > 0 ? (
        <dl className='divide-y divide-border rounded-lg border border-border text-xs'>
          {preview.fields.map((field) => (
            <div
              key={field.label}
              className='grid gap-1 px-3 py-2 sm:grid-cols-[minmax(0,10rem)_1fr] sm:gap-3'
            >
              <dt className='font-medium text-muted-foreground'>
                {field.label}
              </dt>
              <dd className='flex min-w-0 flex-wrap items-center gap-1.5'>
                {field.before != null && field.before !== '' ? (
                  <>
                    <span className='break-words text-muted-foreground line-through'>
                      {field.before}
                    </span>
                    <SteelIcon
                      icon={ArrowRight02Icon}
                      strokeWidth={2}
                      aria-label='passa a ser'
                      className='size-3 shrink-0 text-muted-foreground'
                    />
                  </>
                ) : null}
                <span className='break-words font-medium'>
                  {field.after != null && field.after !== ''
                    ? field.after
                    : '—'}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {preview.target ? (
        <p className='flex items-center gap-1.5 text-xs'>
          <span className='text-muted-foreground'>{preview.target.type}:</span>
          {preview.target.href ? (
            <Link
              href={preview.target.href}
              className='font-medium text-primary underline-offset-2 hover:underline'
            >
              {preview.target.label}
            </Link>
          ) : (
            <span className='font-medium'>{preview.target.label}</span>
          )}
        </p>
      ) : null}

      {status === 'PENDING' ? (
        canApprove ? (
          <footer className='flex flex-wrap items-center justify-end gap-2'>
            <Button
              variant='outline'
              size='sm'
              disabled={busy}
              onClick={doReject}
            >
              Rejeitar
            </Button>
            <Button
              size='sm'
              variant={isDelete ? 'destructive' : 'default'}
              disabled={busy}
              onClick={() => (isDelete ? setAskTwice(true) : doApprove(false))}
            >
              {approve.isPending ? (
                <SteelIcon
                  icon={Loading03Icon}
                  strokeWidth={2}
                  className='animate-spin'
                />
              ) : null}
              {approve.isPending ? 'Executando…' : 'Aprovar'}
            </Button>
          </footer>
        ) : (
          <p className='text-muted-foreground text-xs'>
            Só o responsável pelo agente ou um administrador pode decidir.
          </p>
        )
      ) : outcome ? (
        <footer
          role='status'
          className={cn('flex items-start gap-1.5 text-xs', outcome.className)}
        >
          <SteelIcon
            icon={outcome.icon}
            strokeWidth={2}
            className='mt-px size-3.5 shrink-0'
          />
          <span>
            <span className='font-medium'>{outcome.label}</span>
            {status === 'EXECUTED' && action.resultSummary
              ? ` — ${action.resultSummary}`
              : null}
            {status === 'FAILED' && action.error ? ` — ${action.error}` : null}
          </span>
        </footer>
      ) : null}

      <AlertDialog
        open={askTwice}
        onOpenChange={(open) => {
          if (!open && !approve.isPending) setAskTwice(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar exclusão?</AlertDialogTitle>
            <AlertDialogDescription>
              {preview.title}. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approve.isPending}>
              Voltar
            </AlertDialogCancel>
            <Button
              variant='destructive'
              disabled={approve.isPending}
              onClick={() => doApprove(true)}
            >
              Excluir definitivamente
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  )
}
