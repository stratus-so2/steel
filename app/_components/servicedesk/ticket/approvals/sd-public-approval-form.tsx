'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useRespondSdApproval } from '@/src/hooks/use-sd-ticket-approvals'
import type { SdTicketTypeDTO } from '@/types/sd-ticket'
import type { SdPublicApprovalDTO } from '@/types/sd-ticket-approval'
import { formatDateTime } from '../shared/sd-tab-format'
import {
  SD_APPROVAL_STATUS_LABEL,
  SD_APPROVAL_STATUS_STYLE,
} from './sd-approval-labels'

type Decision = 'APPROVED' | 'REJECTED'

const TYPE_LABEL: Record<SdTicketTypeDTO, string> = {
  INCIDENT: 'Incidente',
  SERVICE_REQUEST: 'Requisição',
  CHANGE: 'Mudança',
  PROBLEM: 'Problema',
}

const CLOSED_MESSAGE: Record<
  Exclude<SdPublicApprovalDTO['status'], 'PENDING'>,
  string
> = {
  APPROVED: 'Esta solicitação foi aprovada.',
  REJECTED: 'Esta solicitação foi reprovada.',
  CANCELED:
    'Este pedido de aprovação foi cancelado ou já foi decidido por outro aprovador.',
  EXPIRED: 'Este link de aprovação expirou. Peça ao responsável um novo link.',
}

/**
 * Página pública de aprovação (sem login): mostra o resumo do chamado e
 * registra a decisão com comentário. `initialDecision` (do `?decision=` do
 * e-mail) só pré-seleciona — a resposta exige o clique.
 */
export function SdPublicApprovalForm({
  token,
  approval,
  initialDecision,
}: {
  token: string
  approval: SdPublicApprovalDTO
  initialDecision?: Decision | null
}) {
  const respond = useRespondSdApproval(token)
  const [current, setCurrent] = useState(approval)
  const [decision, setDecision] = useState<Decision | null>(
    initialDecision ?? null,
  )
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(choice: Decision) {
    setError(null)
    try {
      const result = await respond.mutateAsync({
        decision: choice,
        comment: comment.trim() || null,
      })
      setCurrent(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível registrar')
    }
  }

  const { ticket } = current

  return (
    <div className='flex flex-col gap-5'>
      <div className='flex flex-col gap-1'>
        <span className='text-muted-foreground text-xs'>
          {current.workspaceName} · Pedido de aprovação
        </span>
        <h1 className='font-semibold text-lg leading-snug'>
          {ticket.code} — {ticket.title}
        </h1>
        <div className='flex flex-wrap items-center gap-1.5 text-xs'>
          <Badge variant='outline'>{TYPE_LABEL[ticket.type]}</Badge>
          <Badge variant='secondary'>{ticket.phaseName}</Badge>
          <Badge className={SD_APPROVAL_STATUS_STYLE[current.status]}>
            {SD_APPROVAL_STATUS_LABEL[current.status]}
          </Badge>
        </div>
      </div>

      {ticket.summary ? (
        <p className='whitespace-pre-wrap text-muted-foreground text-sm'>
          {ticket.summary}
        </p>
      ) : null}

      {current.message ? (
        <div className='rounded-md border border-border bg-muted/40 p-3 text-sm'>
          <div className='mb-1 text-muted-foreground text-xs'>
            Mensagem
            {current.requestedByName ? ` de ${current.requestedByName}` : ''}
          </div>
          <p className='whitespace-pre-wrap'>{current.message}</p>
        </div>
      ) : null}

      {current.status === 'PENDING' ? (
        <div className='flex flex-col gap-3'>
          <p className='text-muted-foreground text-xs'>
            {current.approverName ? `${current.approverName}, sua` : 'Sua'}{' '}
            resposta é esperada até {formatDateTime(current.expiresAt)}.
          </p>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder='Comentário (opcional)'
            aria-label='Comentário'
            rows={3}
          />
          {error ? <p className='text-destructive text-sm'>{error}</p> : null}
          <div className='grid grid-cols-2 gap-2'>
            <Button
              type='button'
              variant={decision === 'REJECTED' ? 'destructive' : 'outline'}
              disabled={respond.isPending}
              onClick={() => {
                setDecision('REJECTED')
                void submit('REJECTED')
              }}
              className={cn(
                decision === 'REJECTED' && 'ring-2 ring-destructive/40',
              )}
            >
              Reprovar
            </Button>
            <Button
              type='button'
              variant={decision === 'APPROVED' ? 'default' : 'outline'}
              disabled={respond.isPending}
              onClick={() => {
                setDecision('APPROVED')
                void submit('APPROVED')
              }}
              className={cn(
                decision === 'APPROVED' && 'ring-2 ring-primary/40',
              )}
            >
              Aprovar
            </Button>
          </div>
        </div>
      ) : (
        <div className='flex flex-col gap-2 rounded-md border border-border p-3 text-sm'>
          <p className='font-medium'>{CLOSED_MESSAGE[current.status]}</p>
          {current.respondedAt ? (
            <p className='text-muted-foreground text-xs'>
              Respondido em {formatDateTime(current.respondedAt)}
            </p>
          ) : null}
          {current.comment ? (
            <blockquote className='border-border border-l-2 pl-2 italic'>
              “{current.comment}”
            </blockquote>
          ) : null}
        </div>
      )}
    </div>
  )
}
