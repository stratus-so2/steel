'use client'

import {
  Cancel01Icon,
  PlusSignIcon,
  RefreshIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  type RequestSdTicketApprovalInput,
  useCancelSdTicketApproval,
  useRequestSdTicketApproval,
  useResendSdTicketApproval,
  useSdTicketApprovals,
} from '@/src/hooks/use-sd-ticket-approvals'
import { useSdTicketRealtime } from '@/src/hooks/use-sd-tickets'
import type { SdTicketApprovalDTO } from '@/types/sd-ticket-approval'
import { EmptyState } from '../../settings/sd-settings-kit'
import {
  SD_APPROVAL_STATUS_LABEL,
  SD_APPROVAL_STATUS_STYLE,
} from '../approvals/sd-approval-labels'
import { SdApprovalRequestDialog } from '../approvals/sd-approval-request-dialog'
import { SD_TONE_FILL } from '../sd-ticket-meta'
import { SdAgentOnlyNotice } from '../shared/sd-tab-bits'
import { formatDateTime } from '../shared/sd-tab-format'
import type { SdTicketTabProps } from './types'

function Step({
  label,
  at,
  tone,
}: {
  label: string
  at: string | null
  tone?: 'ok' | 'bad' | 'muted'
}) {
  if (!at) return null
  return (
    <li className='flex items-center gap-2 text-xs'>
      <span
        className={cn(
          'size-2 shrink-0 rounded-full bg-primary',
          tone === 'ok' && SD_TONE_FILL.emerald,
          tone === 'bad' && 'bg-destructive',
          tone === 'muted' && 'bg-muted-foreground/50',
        )}
      />
      <span className='text-muted-foreground'>{label}</span>
      <span className='tabular-nums'>{formatDateTime(at)}</span>
    </li>
  )
}

function ApprovalCard({
  approval,
  onCancel,
  onResend,
  busy,
}: {
  approval: SdTicketApprovalDTO
  onCancel: () => void
  onResend: () => void
  busy: boolean
}) {
  const answered =
    approval.status === 'APPROVED' || approval.status === 'REJECTED'
  const name =
    approval.approver?.name ?? approval.approverName ?? approval.approverEmail
  return (
    <li
      className='flex flex-col gap-2 rounded-lg border border-border bg-card p-3'
      data-testid='sd-approval'
    >
      <div className='flex flex-wrap items-start gap-2'>
        <div className='min-w-0 flex-1'>
          <div className='truncate font-medium text-sm'>{name}</div>
          <div className='truncate text-muted-foreground text-xs'>
            {approval.approverEmail}
            {approval.approver ? ' · usuário do workspace' : ' · externo'}
          </div>
        </div>
        <Badge className={SD_APPROVAL_STATUS_STYLE[approval.status]}>
          {SD_APPROVAL_STATUS_LABEL[approval.status]}
        </Badge>
      </div>

      {approval.message ? (
        <p className='whitespace-pre-wrap rounded-md bg-muted/50 px-2.5 py-1.5 text-xs'>
          {approval.message}
        </p>
      ) : null}

      <ol className='flex flex-col gap-1'>
        <Step
          label={`Pedida${approval.requestedBy ? ` por ${approval.requestedBy.name}` : ''}`}
          at={approval.createdAt}
        />
        <Step label='E-mail enviado' at={approval.sentAt} />
        <Step
          label={
            answered ? SD_APPROVAL_STATUS_LABEL[approval.status] : 'Respondida'
          }
          at={approval.respondedAt}
          tone={approval.status === 'APPROVED' ? 'ok' : 'bad'}
        />
        {approval.status === 'PENDING' || approval.status === 'EXPIRED' ? (
          <Step
            label={approval.status === 'EXPIRED' ? 'Expirou' : 'Expira'}
            at={approval.expiresAt}
            tone='muted'
          />
        ) : null}
      </ol>

      {approval.comment ? (
        <blockquote className='border-border border-l-2 pl-2 text-sm italic'>
          “{approval.comment}”
        </blockquote>
      ) : null}

      {approval.status === 'PENDING' || approval.status === 'EXPIRED' ? (
        <div className='flex gap-1.5'>
          <Button
            size='xs'
            variant='outline'
            disabled={busy}
            onClick={onResend}
            aria-label={`Reenviar para ${name}`}
          >
            <SteelIcon icon={RefreshIcon} />
            Reenviar
          </Button>
          {approval.status === 'PENDING' ? (
            <Button
              size='xs'
              variant='ghost'
              disabled={busy}
              onClick={onCancel}
              aria-label={`Cancelar pedido de ${name}`}
            >
              <SteelIcon icon={Cancel01Icon} />
              Cancelar
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

/** Aprovações do chamado (pedido por e-mail com link público). */
export function SdTicketApprovalsTab({
  workspaceId,
  ticket,
  mode,
}: SdTicketTabProps) {
  const ticketRef = ticket.id
  const isAgent = mode === 'agent'
  useSdTicketRealtime(isAgent ? workspaceId : undefined)
  const query = useSdTicketApprovals(isAgent ? workspaceId : '', ticketRef)
  const request = useRequestSdTicketApproval(workspaceId, ticketRef)
  const cancel = useCancelSdTicketApproval(workspaceId, ticketRef)
  const resend = useResendSdTicketApproval(workspaceId, ticketRef)
  const [open, setOpen] = useState(false)

  if (!isAgent) return <SdAgentOnlyNotice />

  const items = query.data ?? []
  const busy = cancel.isPending || resend.isPending

  async function submit(input: RequestSdTicketApprovalInput) {
    try {
      const created = await request.mutateAsync(input)
      notify.success(
        created.length === 1
          ? 'Pedido de aprovação enviado'
          : `${created.length} pedidos de aprovação enviados`,
      )
      setOpen(false)
    } catch (error) {
      notify.error(error)
    }
  }

  return (
    <div className='flex flex-col gap-4 p-4'>
      <div className='flex items-start justify-between gap-2'>
        <div>
          <h3 className='font-medium text-sm'>Aprovações</h3>
          <p className='text-muted-foreground text-xs'>
            Aprovadores respondem pelo link do e-mail, sem precisar entrar. A
            primeira resposta decide o pedido.
          </p>
        </div>
        <Button size='sm' onClick={() => setOpen(true)}>
          <SteelIcon icon={PlusSignIcon} />
          Pedir aprovação
        </Button>
      </div>

      {query.error ? (
        <EmptyState>{query.error.message}</EmptyState>
      ) : !query.isLoading && items.length === 0 ? (
        <EmptyState>Nenhuma aprovação pedida neste chamado.</EmptyState>
      ) : (
        <ul className='flex flex-col gap-2'>
          {items.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              busy={busy}
              onCancel={() =>
                cancel.mutate(approval.id, {
                  onSuccess: () => notify.success('Pedido cancelado'),
                  onError: (error) => notify.error(error),
                })
              }
              onResend={() =>
                resend.mutate(
                  { approvalId: approval.id },
                  {
                    onSuccess: () => notify.success('Novo link enviado'),
                    onError: (error) => notify.error(error),
                  },
                )
              }
            />
          ))}
        </ul>
      )}

      <SdApprovalRequestDialog
        workspaceId={workspaceId}
        open={open}
        pending={request.isPending}
        onOpenChange={setOpen}
        onSubmit={(input) => void submit(input)}
      />
    </div>
  )
}
