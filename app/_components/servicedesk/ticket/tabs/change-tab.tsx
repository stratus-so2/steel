'use client'

import {
  Alert02Icon,
  Calendar03Icon,
  SnowIcon,
  UserGroupIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  useSdApprovalRoundMutations,
  useSdApprovalRounds,
  useSdTicketChangeSchedule,
} from '@/src/hooks/use-sd-changes'
import { useSdConfigList } from '@/src/hooks/use-sd-config'
import { useSdTicketRealtime } from '@/src/hooks/use-sd-tickets'
import type { SdApprovalRoundDTO, SdCabBoardDTO } from '@/types/sd-cab'
import type {
  SdChangeWindowKindDTO,
  SdTicketChangeScheduleDTO,
} from '@/types/sd-change'
import {
  SD_APPROVAL_ROUND_STATUS_LABEL,
  sdTallySummary,
  sdWarningKindLabel,
  sdWindowKindLabel,
} from '../../changes/sd-change-labels'
import { EmptyState, SimpleSelect } from '../../settings/sd-settings-kit'
import {
  SD_APPROVAL_STATUS_LABEL,
  SD_APPROVAL_STATUS_STYLE,
} from '../approvals/sd-approval-labels'
import { SdAgentOnlyNotice } from '../shared/sd-tab-bits'
import { formatDateTime } from '../shared/sd-tab-format'
import { SD_TONE, SD_TONE_FILL, SD_TONE_SOFT } from '../sd-ticket-meta'
import type { SdTicketTabProps } from './types'

/**
 * Aba "Mudança" do chamado: a janela planejada com as janelas de manutenção
 * e congelamento que a cobrem, os conflitos detectados, e a rodada de
 * aprovação do comitê (quem já votou e quanto falta para o quórum).
 *
 * Só aparece em chamados do tipo `CHANGE` (ver `SD_TICKET_TABS`).
 */
export function SdTicketChangeTab({
  workspaceId,
  ticket,
  mode,
}: SdTicketTabProps) {
  useSdTicketRealtime(workspaceId)
  if (mode !== 'agent') return <SdAgentOnlyNotice />

  return (
    <div className='flex flex-col gap-6 p-4'>
      <ScheduleBlock workspaceId={workspaceId} ticketRef={ticket.id} />
      <RoundsBlock workspaceId={workspaceId} ticketRef={ticket.id} />
    </div>
  )
}

/** Tom de cada janela que cobre a mudança (mapa fechado). */
const WINDOW_TONE: Record<SdChangeWindowKindDTO, string> = {
  FREEZE: SD_TONE_SOFT.rose,
  MAINTENANCE: SD_TONE_SOFT.sky,
}

/* ------------------------------- agenda ---------------------------------- */

function ScheduleBlock({
  workspaceId,
  ticketRef,
}: {
  workspaceId: string
  ticketRef: string
}) {
  const { data, isLoading, error } = useSdTicketChangeSchedule(
    workspaceId,
    ticketRef,
  )

  return (
    <section className='flex flex-col gap-3'>
      <header className='flex items-center gap-2'>
        <SteelIcon
          icon={Calendar03Icon}
          strokeWidth={2}
          className='size-4 text-muted-foreground'
        />
        <h2 className='font-medium text-sm'>Agenda da mudança</h2>
      </header>
      {error ? (
        <EmptyState>{error.message}</EmptyState>
      ) : isLoading || !data ? (
        <EmptyState>Carregando a agenda…</EmptyState>
      ) : (
        <ScheduleBody schedule={data} />
      )}
    </section>
  )
}

function ScheduleBody({ schedule }: { schedule: SdTicketChangeScheduleDTO }) {
  if (!schedule.plannedStartAt || !schedule.plannedEndAt) {
    return (
      <EmptyState>
        Sem janela planejada. Preencha o início e o fim planejados no painel do
        chamado para o sistema conferir congelamentos e conflitos.
      </EmptyState>
    )
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='rounded-lg border border-border bg-card px-4 py-3'>
        <p className='font-medium text-sm tabular-nums'>
          {formatDateTime(schedule.plannedStartAt)} –{' '}
          {formatDateTime(schedule.plannedEndAt)}
        </p>
        <p className='text-muted-foreground text-xs'>
          {schedule.configItemName
            ? `Item de configuração: ${schedule.configItemName}`
            : 'Sem item de configuração — não há conflito a apurar.'}
        </p>
      </div>

      {schedule.windows.length > 0 ? (
        <div className='flex flex-col gap-2'>
          {schedule.windows.map((window) => (
            <div
              key={`${window.windowId}-${window.startsAt}`}
              className={cn(
                'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs',
                WINDOW_TONE[window.kind],
              )}
            >
              <SteelIcon
                icon={window.kind === 'FREEZE' ? SnowIcon : Calendar03Icon}
                strokeWidth={2}
                className='mt-px size-4 shrink-0'
              />
              <div>
                <p className='font-medium'>{window.name}</p>
                <p className='opacity-80'>
                  {sdWindowKindLabel(window.kind)} ·{' '}
                  {formatDateTime(window.startsAt)} –{' '}
                  {formatDateTime(window.endsAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {schedule.warnings.length === 0 ? (
        <p
          className={cn(
            'rounded-lg border px-3 py-2 text-xs',
            SD_TONE_SOFT.emerald,
          )}
        >
          Nenhum congelamento nem conflito neste período.
        </p>
      ) : (
        <div className='flex flex-col gap-2'>
          {schedule.warnings.map((warning) => (
            <div
              key={`${warning.kind}-${warning.windowId ?? warning.ticketId}`}
              className={cn(
                'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs',
                SD_TONE_SOFT.amber,
              )}
            >
              <SteelIcon
                icon={warning.kind === 'FREEZE' ? SnowIcon : Alert02Icon}
                strokeWidth={2}
                className='mt-px size-4 shrink-0'
              />
              <div>
                <p className='font-medium'>
                  {sdWarningKindLabel(warning.kind)}
                </p>
                <p className='opacity-80'>{warning.message}</p>
              </div>
            </div>
          ))}
          <p className='text-muted-foreground text-xs'>
            Avisos não bloqueiam o que já está salvo. Ao mudar a janela, só um
            administrador do ServiceDesk pode confirmar e seguir mesmo assim — e
            o que for ignorado fica registrado na rastreabilidade.
          </p>
        </div>
      )}
    </div>
  )
}

/* -------------------------------- rodadas -------------------------------- */

function RoundsBlock({
  workspaceId,
  ticketRef,
}: {
  workspaceId: string
  ticketRef: string
}) {
  const { data, isLoading, error } = useSdApprovalRounds(workspaceId, ticketRef)
  const boards = useSdConfigList<SdCabBoardDTO>(workspaceId, 'cab-boards')
  const mutations = useSdApprovalRoundMutations(workspaceId, ticketRef)
  const [opening, setOpening] = useState(false)
  const [boardId, setBoardId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const rounds = data ?? []
  const hasOpen = rounds.some((round) => round.status === 'PENDING')

  async function open() {
    try {
      await mutations.open.mutateAsync({
        ...(boardId ? { boardId } : {}),
        message: message.trim() || null,
      })
      notify.success('Rodada de aprovação aberta')
      setOpening(false)
      setBoardId(null)
      setMessage('')
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <section className='flex flex-col gap-3'>
      <header className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex items-center gap-2'>
          <SteelIcon
            icon={UserGroupIcon}
            strokeWidth={2}
            className='size-4 text-muted-foreground'
          />
          <h2 className='font-medium text-sm'>Comitê de mudanças (CAB)</h2>
        </div>
        {!hasOpen && !opening ? (
          <Button type='button' size='sm' onClick={() => setOpening(true)}>
            Abrir rodada
          </Button>
        ) : null}
      </header>

      {opening ? (
        <div className='flex flex-col gap-3 rounded-lg border border-border bg-card p-4'>
          <SimpleSelect
            value={boardId}
            onChange={setBoardId}
            options={(boards.data ?? []).map((board) => ({
              value: board.id,
              label: `${board.name} · quórum ${board.effectiveQuorum}`,
            }))}
            allowEmpty
            emptyLabel='Escolher pelas condições'
            placeholder='Comitê'
          />
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder='Mensagem para os aprovadores (opcional)'
          />
          <div className='flex justify-end gap-2'>
            <Button
              type='button'
              size='sm'
              variant='outline'
              onClick={() => setOpening(false)}
            >
              Cancelar
            </Button>
            <Button
              type='button'
              size='sm'
              disabled={mutations.open.isPending}
              onClick={open}
            >
              {mutations.open.isPending ? 'Abrindo...' : 'Abrir rodada'}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <EmptyState>{error.message}</EmptyState>
      ) : !isLoading && rounds.length === 0 ? (
        <EmptyState>
          Nenhuma rodada aberta. O comitê dispara um pedido por membro e a
          rodada fecha sozinha ao bater o quórum.
        </EmptyState>
      ) : (
        <div className='flex flex-col gap-3'>
          {rounds.map((round) => (
            <RoundCard
              key={round.id}
              round={round}
              canceling={mutations.cancel.isPending}
              onCancel={async () => {
                try {
                  await mutations.cancel.mutateAsync(round.id)
                  notify.success('Rodada cancelada')
                } catch (err) {
                  notify.error(err)
                }
              }}
            />
          ))}
        </div>
      )}
    </section>
  )
}

const ROUND_STYLE: Record<SdApprovalRoundDTO['status'], string> = {
  PENDING: SD_TONE.amber,
  APPROVED: SD_TONE.emerald,
  REJECTED: 'bg-destructive/10 text-destructive',
  CANCELED: 'bg-muted text-muted-foreground',
  EXPIRED: 'bg-muted text-muted-foreground',
}

function RoundCard({
  round,
  canceling,
  onCancel,
}: {
  round: SdApprovalRoundDTO
  canceling: boolean
  onCancel: () => void
}) {
  const progress =
    round.quorum > 0
      ? Math.min(100, Math.round((round.tally.approved / round.quorum) * 100))
      : 0

  return (
    <article className='flex flex-col gap-3 rounded-lg border border-border bg-card p-4'>
      <div className='flex flex-wrap items-start justify-between gap-2'>
        <div className='min-w-0'>
          <div className='flex flex-wrap items-center gap-2'>
            <span className='font-medium text-sm'>
              {round.boardName ?? 'Comitê removido'}
            </span>
            <Badge className={ROUND_STYLE[round.status]} variant='secondary'>
              {SD_APPROVAL_ROUND_STATUS_LABEL[round.status]}
            </Badge>
          </div>
          <p className='text-muted-foreground text-xs'>
            Aberta em {formatDateTime(round.createdAt)}
            {round.requestedBy ? ` por ${round.requestedBy.name}` : ''}
            {round.decidedAt
              ? ` · decidida em ${formatDateTime(round.decidedAt)}`
              : ''}
          </p>
        </div>
        {round.status === 'PENDING' ? (
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={canceling}
            onClick={onCancel}
          >
            Cancelar rodada
          </Button>
        ) : null}
      </div>

      <div className='flex flex-col gap-1.5'>
        <div className='flex items-center justify-between gap-2 text-xs'>
          <span className='font-medium'>
            {sdTallySummary(round.tally, round.quorum)}
          </span>
          <span className='text-muted-foreground tabular-nums'>
            {round.tally.approved}/{round.quorum}
          </span>
        </div>
        <div
          className='h-1.5 overflow-hidden rounded-full bg-muted'
          role='progressbar'
          aria-valuenow={round.tally.approved}
          aria-valuemin={0}
          aria-valuemax={round.quorum}
          aria-label='Progresso do quórum'
        >
          <div
            className={cn(
              'h-full rounded-full transition-all',
              round.status === 'REJECTED'
                ? 'bg-destructive'
                : progress >= 100
                  ? SD_TONE_FILL.emerald
                  : 'bg-primary',
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        {round.rejectEnds ? (
          <p className='text-muted-foreground text-xs'>
            Uma reprovação encerra a rodada.
          </p>
        ) : null}
      </div>

      <ul className='flex flex-col gap-1'>
        {round.approvals.map((approval) => (
          <li
            key={approval.id}
            className='flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-xs'
          >
            <span className='min-w-0 truncate'>
              {approval.approver?.name ??
                approval.approverName ??
                approval.approverEmail}
            </span>
            <span className='flex items-center gap-2'>
              {approval.respondedAt ? (
                <span className='text-muted-foreground tabular-nums'>
                  {formatDateTime(approval.respondedAt)}
                </span>
              ) : null}
              <Badge
                variant='secondary'
                className={SD_APPROVAL_STATUS_STYLE[approval.status]}
              >
                {SD_APPROVAL_STATUS_LABEL[approval.status]}
              </Badge>
            </span>
          </li>
        ))}
      </ul>
      {round.approvals.some((a) => a.comment) ? (
        <ul className='flex flex-col gap-1 border-t pt-2'>
          {round.approvals
            .filter((a) => a.comment)
            .map((a) => (
              <li key={`${a.id}-comment`} className='text-xs'>
                <span className='text-muted-foreground'>
                  {a.approver?.name ?? a.approverName ?? a.approverEmail}:
                </span>{' '}
                {a.comment}
              </li>
            ))}
        </ul>
      ) : null}
    </article>
  )
}
