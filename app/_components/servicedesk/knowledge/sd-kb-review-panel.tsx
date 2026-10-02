'use client'

import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  MessageEdit01Icon,
  SentIcon,
  UserCheck01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import { useSdAgents, useSdMe } from '@/src/hooks/use-sd-config'
import {
  useCancelSdKbReview,
  useDecideSdKbReview,
  useRequestSdKbReview,
  useSdKbReviewState,
  useSetSdKbReviewInterval,
} from '@/src/hooks/use-sd-knowledge'
import type { SdKbArticleDTO } from '@/types/sd-kb-article'
import type { SdKbReviewDTO } from '@/types/sd-kb-review'
import { sdKbRelativeTime } from './sd-kb-utils'

/** Data e hora no fuso do workspace (o navegador do agente não decide isso). */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  })
}

const DECISION_LABEL: Record<SdKbReviewDTO['status'], string> = {
  PENDING: 'Aguardando revisão',
  APPROVED: 'Aprovado',
  CHANGES_REQUESTED: 'Mudanças pedidas',
}

/**
 * Painel KCS do artigo (lateral do editor): ciclo de revisão
 * (rascunho → em revisão → publicado), validade da revisão, reuso
 * ("resolveu N chamados") e o histórico das decisões.
 */
export function SdKbReviewPanel({
  workspaceId,
  article,
}: {
  workspaceId: string
  article: SdKbArticleDTO
}) {
  const me = useSdMe(workspaceId)
  const agents = useSdAgents(workspaceId)
  const state = useSdKbReviewState(workspaceId, article.id)
  const request = useRequestSdKbReview(workspaceId, article.id)
  const decide = useDecideSdKbReview(workspaceId, article.id)
  const cancel = useCancelSdKbReview(workspaceId, article.id)
  const setInterval = useSetSdKbReviewInterval(workspaceId, article.id)

  const [reviewerId, setReviewerId] = useState<string>('')
  const [note, setNote] = useState('')
  const [changes, setChanges] = useState('')
  const [days, setDays] = useState<string>('')

  const data = state.data
  const pending = data?.pending ?? null
  const userId = me.data?.userId
  const isAdmin = me.data?.isAdmin ?? false
  const isAuthor = article.createdById === userId
  const canRequest = isAuthor || isAdmin
  const canDecide =
    !!pending && (pending.reviewerId === userId || (isAdmin && !!userId))
  const reviewers = (agents.data ?? []).filter(
    (agent) => agent.isAgent && agent.id !== userId,
  )

  if (state.isLoading || !data) {
    return <Skeleton className='h-40 w-full' aria-label='Carregando revisão' />
  }

  return (
    <section className='space-y-3 rounded-lg border p-3'>
      <header className='flex items-center justify-between gap-2'>
        <p className='font-medium text-muted-foreground text-xs uppercase tracking-wide'>
          Revisão (KCS)
        </p>
        {data.overdue ? (
          <Badge
            variant='outline'
            className='gap-1 border-destructive/40 bg-destructive/10 text-destructive'
          >
            <SteelIcon icon={Alert02Icon} size={12} strokeWidth={2} />
            Revisão vencida
          </Badge>
        ) : null}
      </header>

      <dl className='space-y-1 text-xs'>
        <div className='flex items-center justify-between gap-2'>
          <dt className='text-muted-foreground'>Resolveu</dt>
          <dd className='font-medium tabular-nums'>
            {article.reuseCount}{' '}
            {article.reuseCount === 1 ? 'chamado' : 'chamados'}
          </dd>
        </div>
        <div className='flex items-center justify-between gap-2'>
          <dt className='text-muted-foreground'>Última revisão</dt>
          <dd>
            {data.lastReviewedAt
              ? sdKbRelativeTime(data.lastReviewedAt)
              : 'nunca revisado'}
          </dd>
        </div>
        <div className='flex items-center justify-between gap-2'>
          <dt className='text-muted-foreground'>Próxima revisão</dt>
          <dd className={data.overdue ? 'font-medium text-destructive' : ''}>
            {data.reviewDueAt ? formatDate(data.reviewDueAt) : 'sem validade'}
          </dd>
        </div>
      </dl>

      <div className='space-y-1.5'>
        <Label htmlFor='sd-kb-interval' className='text-xs'>
          Validade da revisão
        </Label>
        <div className='flex items-center gap-2'>
          <Input
            id='sd-kb-interval'
            type='number'
            min={1}
            max={3650}
            inputMode='numeric'
            className='h-8'
            placeholder={String(data.effectiveIntervalDays)}
            value={days === '' ? (data.reviewIntervalDays ?? '') : days}
            onChange={(event) => setDays(event.target.value)}
          />
          <Button
            size='xs'
            variant='outline'
            disabled={setInterval.isPending}
            onClick={() => {
              const parsed = days === '' ? null : Number(days)
              setInterval.mutate(
                parsed !== null && Number.isFinite(parsed) ? parsed : null,
                {
                  onSuccess: () => {
                    setDays('')
                    notify.success('Validade atualizada.')
                  },
                  onError: notify.error,
                },
              )
            }}
          >
            Salvar
          </Button>
        </div>
        <p className='text-muted-foreground text-xs'>
          Em branco usa o padrão do workspace ({data.effectiveIntervalDays}{' '}
          dias).
        </p>
      </div>

      {pending ? (
        <div className='space-y-2 rounded-md border border-dashed p-2.5'>
          <p className='flex items-center gap-1.5 font-medium text-xs'>
            <SteelIcon icon={UserCheck01Icon} size={13} strokeWidth={2} />
            Em revisão com {pending.reviewer?.name ?? 'um agente'}
          </p>
          {pending.comment ? (
            <p className='text-muted-foreground text-xs'>{pending.comment}</p>
          ) : null}
          {canDecide ? (
            <div className='space-y-2'>
              <Textarea
                aria-label='Comentário da revisão'
                placeholder='O que precisa mudar? (obrigatório para pedir mudanças)'
                className='min-h-16 text-xs'
                value={changes}
                onChange={(event) => setChanges(event.target.value)}
              />
              <div className='flex flex-wrap gap-2'>
                <Button
                  size='xs'
                  disabled={decide.isPending}
                  onClick={() =>
                    decide.mutate(
                      { reviewId: pending.id, decision: 'APPROVE' },
                      {
                        onSuccess: () => {
                          setChanges('')
                          notify.success('Artigo aprovado e publicado.')
                        },
                        onError: notify.error,
                      },
                    )
                  }
                >
                  <SteelIcon icon={CheckmarkCircle02Icon} strokeWidth={2} />
                  Aprovar e publicar
                </Button>
                <Button
                  size='xs'
                  variant='outline'
                  disabled={decide.isPending || changes.trim().length === 0}
                  onClick={() =>
                    decide.mutate(
                      {
                        reviewId: pending.id,
                        decision: 'REQUEST_CHANGES',
                        comment: changes.trim(),
                      },
                      {
                        onSuccess: () => {
                          setChanges('')
                          notify.success('Mudanças pedidas ao autor.')
                        },
                        onError: notify.error,
                      },
                    )
                  }
                >
                  <SteelIcon icon={MessageEdit01Icon} strokeWidth={2} />
                  Pedir mudanças
                </Button>
              </div>
            </div>
          ) : null}
          {canRequest ? (
            <Button
              size='xs'
              variant='ghost'
              disabled={cancel.isPending}
              onClick={() =>
                cancel.mutate(pending.id, {
                  onSuccess: () => notify.success('Revisão cancelada.'),
                  onError: notify.error,
                })
              }
            >
              Cancelar revisão
            </Button>
          ) : null}
        </div>
      ) : canRequest ? (
        <div className='space-y-2'>
          <Label htmlFor='sd-kb-reviewer' className='text-xs'>
            Enviar para revisão
          </Label>
          <Select
            value={reviewerId}
            onValueChange={(value) => setReviewerId(String(value))}
          >
            <SelectTrigger
              id='sd-kb-reviewer'
              size='sm'
              aria-label='Revisor'
              className='h-8 text-xs'
            >
              <span>
                {reviewers.find((agent) => agent.id === reviewerId)?.name ??
                  'Escolha um agente'}
              </span>
            </SelectTrigger>
            <SelectContent>
              {reviewers.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            aria-label='Recado para o revisor'
            placeholder='Algo que o revisor precisa saber (opcional)'
            className='min-h-16 text-xs'
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <Button
            size='xs'
            className='w-full'
            disabled={request.isPending || !reviewerId}
            onClick={() =>
              request.mutate(
                {
                  reviewerId,
                  comment: note.trim() ? note.trim() : undefined,
                },
                {
                  onSuccess: () => {
                    setNote('')
                    notify.success('Artigo enviado para revisão.')
                  },
                  onError: notify.error,
                },
              )
            }
          >
            <SteelIcon icon={SentIcon} strokeWidth={2} />
            Pedir revisão
          </Button>
        </div>
      ) : (
        <p className='text-muted-foreground text-xs'>
          Só o autor do artigo (ou um admin) pode pedir revisão.
        </p>
      )}

      {data.history.length > 0 ? (
        <ul className='space-y-1.5 border-t pt-2'>
          {data.history.map((item) => (
            <li
              key={item.id}
              className='flex flex-col gap-0.5 text-muted-foreground text-xs'
            >
              <span className='flex items-center gap-1'>
                <SteelIcon icon={Clock01Icon} size={12} strokeWidth={2} />
                {DECISION_LABEL[item.status]} ·{' '}
                {item.reviewer?.name ?? 'sem revisor'} ·{' '}
                {sdKbRelativeTime(item.decidedAt ?? item.createdAt)}
              </span>
              {item.comment ? (
                <span className='pl-4 text-foreground/80'>{item.comment}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
