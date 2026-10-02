'use client'

import {
  PauseIcon,
  PencilEdit02Icon,
  PlayIcon,
  PlusSignIcon,
  StopIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useEffect, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { notify } from '@/lib/notify'
import { useSdTicketRealtime } from '@/src/hooks/use-sd-tickets'
import {
  useCreateSdTimeEntry,
  useDeleteSdTimeEntry,
  useSdTimeEntries,
  useSdTimer,
  useUpdateSdTimeEntry,
} from '@/src/hooks/use-sd-time-entries'
import type { SdTimeEntryDTO } from '@/types/sd-time-entry'
import {
  formatSdAllowance,
  formatSdMinutes,
  SD_RATE_WINDOW_LABEL,
} from '../../contracts/sd-contract-labels'
import { cn } from '@/lib/utils'
import { ConfirmDeleteButton, EmptyState } from '../../settings/sd-settings-kit'
import { SD_TONE_SOFT } from '../sd-ticket-meta'
import { SdTimeEntryFormDialog } from '../hours/sd-time-entry-form-dialog'
import { SdAgentOnlyNotice, SdSummaryCard } from '../shared/sd-tab-bits'
import { formatBRL, formatDateTime, formatTime } from '../shared/sd-tab-format'
import type { SdTicketTabProps } from './types'

/**
 * Aba "Horas" do chamado: cronômetro (um aberto por usuário), lançamento
 * manual, a lista de apontamentos e o total. O contrato do cliente decide o
 * arredondamento, o mínimo por chamado, a janela e o valor — a tela só
 * mostra o que o servidor calculou.
 */

/** Cronômetro vivo: segundos decorridos desde `startedAt`. */
function useElapsed(startedAt: string | null): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!startedAt) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [startedAt])
  if (!startedAt) return 0
  const started = new Date(startedAt).getTime()
  return Math.max(0, Math.floor((now - started) / 1000))
}

function formatClock(seconds: number): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds % 60)}`
}

export function SdTicketHoursTab({
  workspaceId,
  ticket,
  me,
  mode,
}: SdTicketTabProps) {
  const ticketRef = ticket.id
  const isAgent = mode === 'agent'
  useSdTicketRealtime(isAgent ? workspaceId : undefined)
  const query = useSdTimeEntries(isAgent ? workspaceId : '', ticketRef)
  const timer = useSdTimer(workspaceId, ticketRef)
  const create = useCreateSdTimeEntry(workspaceId, ticketRef)
  const update = useUpdateSdTimeEntry(workspaceId, ticketRef)
  const remove = useDeleteSdTimeEntry(workspaceId, ticketRef)
  const [dialog, setDialog] = useState<{ entry: SdTimeEntryDTO | null } | null>(
    null,
  )

  const running = query.data?.running ?? null
  const runningHere = running?.ticketId === ticketRef ? running : null
  const elapsed = useElapsed(runningHere?.startedAt ?? null)

  if (!isAgent) return <SdAgentOnlyNotice />

  const items = query.data?.items ?? []
  const summary = query.data?.summary
  const contract = query.data?.contract ?? null

  function act(action: 'start' | 'pause' | 'resume' | 'stop') {
    timer.mutate({ action }, { onError: (error) => notify.error(error) })
  }

  async function submit(data: {
    startedAt: string
    endedAt: string
    billable: boolean
    description: string | null
    userId: string | null
  }) {
    try {
      if (dialog?.entry) {
        await update.mutateAsync({
          id: dialog.entry.id,
          data: {
            startedAt: data.startedAt,
            endedAt: data.endedAt,
            billable: data.billable,
            description: data.description,
          },
        })
      } else {
        await create.mutateAsync({
          startedAt: data.startedAt,
          endedAt: data.endedAt,
          billable: data.billable,
          description: data.description,
          ...(data.userId ? { userId: data.userId } : {}),
        })
      }
      setDialog(null)
    } catch (error) {
      notify.error(error)
    }
  }

  return (
    <div className='flex flex-col gap-4 p-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <h3 className='font-medium text-sm'>Horas do atendimento</h3>
        <div className='flex items-center gap-2'>
          {runningHere ? (
            <>
              <span
                role='timer'
                aria-label='Tempo do cronômetro'
                className='font-semibold text-base tabular-nums'
              >
                {formatClock(elapsed)}
              </span>
              <Button
                size='sm'
                variant='outline'
                disabled={timer.isPending}
                onClick={() => act('pause')}
              >
                <SteelIcon icon={PauseIcon} strokeWidth={2} />
                Pausar
              </Button>
              <Button
                size='sm'
                disabled={timer.isPending}
                onClick={() => act('stop')}
              >
                <SteelIcon icon={StopIcon} strokeWidth={2} />
                Parar
              </Button>
            </>
          ) : (
            <Button
              size='sm'
              variant='outline'
              disabled={timer.isPending || Boolean(running)}
              onClick={() => act(items.length > 0 ? 'resume' : 'start')}
            >
              <SteelIcon icon={PlayIcon} strokeWidth={2} />
              {items.length > 0 ? 'Retomar' : 'Iniciar'}
            </Button>
          )}
          <Button size='sm' onClick={() => setDialog({ entry: null })}>
            <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
            Lançar horas
          </Button>
        </div>
      </div>

      {running && !runningHere ? (
        <p className={cn('rounded-lg border px-3 py-2 text-xs', SD_TONE_SOFT.amber)}>
          Você tem um cronômetro em andamento em outro chamado. Pare-o antes de
          iniciar um aqui.
        </p>
      ) : null}

      {summary ? (
        <div className='grid grid-cols-1 gap-2 sm:grid-cols-3'>
          <SdSummaryCard
            label='Total apontado'
            value={formatSdMinutes(summary.totalMinutes)}
          />
          <SdSummaryCard
            label='Faturável'
            value={formatSdMinutes(summary.billableMinutes)}
            hint={
              summary.nonBillableMinutes > 0
                ? `${formatSdMinutes(summary.nonBillableMinutes)} interno`
                : undefined
            }
          />
          <SdSummaryCard label='Valor' value={formatBRL(summary.amount)} />
        </div>
      ) : null}

      {contract ? (
        <div className='rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs'>
          <span className='font-medium'>{contract.name}</span>
          {contract.code ? (
            <span className='font-mono text-muted-foreground'>
              {' '}
              · {contract.code}
            </span>
          ) : null}
          <span className='text-muted-foreground'>
            {' '}
            · arredonda {contract.roundingMinutes} min
            {contract.minimumMinutes > 0
              ? ` · mínimo ${contract.minimumMinutes} min/dia`
              : ''}
          </span>
          {contract.period ? (
            <span className='block text-muted-foreground'>
              Período:{' '}
              {formatSdAllowance(
                contract.period.billableMinutes,
                contract.period.includedMinutes,
              )}
              {contract.period.overageMinutes > 0
                ? ` · ${formatSdMinutes(contract.period.overageMinutes)} de excedente`
                : ''}{' '}
              · {formatBRL(contract.period.amount)}
            </span>
          ) : null}
        </div>
      ) : (
        <p className='text-muted-foreground text-xs'>
          O cliente deste chamado não tem contrato vigente: as horas ficam
          registradas, mas sem valor.
        </p>
      )}

      {query.error ? (
        <EmptyState>{query.error.message}</EmptyState>
      ) : !query.isLoading && items.length === 0 ? (
        <EmptyState>Nenhuma hora apontada.</EmptyState>
      ) : (
        <div className='overflow-x-auto rounded-lg border border-border'>
          <table className='w-full text-sm'>
            <thead className='bg-muted/50 text-left text-muted-foreground text-xs'>
              <tr>
                <th className='px-3 py-2 font-medium'>Quando</th>
                <th className='px-3 py-2 font-medium'>Agente</th>
                <th className='px-3 py-2 font-medium'>Janela</th>
                <th className='px-3 py-2 text-right font-medium'>Tempo</th>
                <th className='px-3 py-2 text-right font-medium'>Valor</th>
                <th className='w-16 px-3 py-2' />
              </tr>
            </thead>
            <tbody>
              {items.map((entry) => (
                <tr key={entry.id} className='border-border border-t'>
                  <td className='whitespace-nowrap px-3 py-2'>
                    {formatDateTime(entry.startedAt)}
                    {entry.endedAt ? (
                      <span className='text-muted-foreground'>
                        {' → '}
                        {formatTime(entry.endedAt)}
                      </span>
                    ) : (
                      <Badge variant='secondary' className='ml-1.5'>
                        Em andamento
                      </Badge>
                    )}
                    {entry.description ? (
                      <span className='block max-w-72 truncate text-muted-foreground text-xs'>
                        {entry.description}
                      </span>
                    ) : null}
                  </td>
                  <td className='px-3 py-2'>
                    {entry.user.name}
                    <span className='block text-muted-foreground text-[11px]'>
                      {entry.source === 'TIMER' ? 'cronômetro' : 'manual'}
                      {entry.billable ? '' : ' · interno'}
                    </span>
                  </td>
                  <td className='px-3 py-2'>
                    {SD_RATE_WINDOW_LABEL[entry.window]}
                  </td>
                  <td className='px-3 py-2 text-right tabular-nums'>
                    {entry.endedAt ? formatSdMinutes(entry.minutes) : '—'}
                  </td>
                  <td className='px-3 py-2 text-right font-medium tabular-nums'>
                    {entry.amount ? formatBRL(entry.amount) : '—'}
                  </td>
                  <td className='px-3 py-2'>
                    {entry.editable ? (
                      <div className='flex justify-end gap-0.5'>
                        {entry.endedAt ? (
                          <Button
                            type='button'
                            size='icon-xs'
                            variant='ghost'
                            aria-label={`Editar o apontamento de ${entry.user.name}`}
                            onClick={() => setDialog({ entry })}
                          >
                            <SteelIcon
                              icon={PencilEdit02Icon}
                              strokeWidth={2}
                            />
                          </Button>
                        ) : null}
                        <ConfirmDeleteButton
                          title='Excluir apontamento?'
                          description={`${formatSdMinutes(entry.minutes)} de ${entry.user.name} serão removidos do período.`}
                          pending={remove.isPending}
                          onConfirm={() =>
                            remove.mutate(entry.id, {
                              onError: (error) => notify.error(error),
                            })
                          }
                        />
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog ? (
        <SdTimeEntryFormDialog
          key={dialog.entry?.id ?? 'new'}
          workspaceId={workspaceId}
          open
          entry={dialog.entry}
          canPickAgent={me.isAdmin}
          pending={create.isPending || update.isPending}
          onOpenChange={(open) => {
            if (!open) setDialog(null)
          }}
          onSubmit={(data) => void submit(data)}
        />
      ) : null}
    </div>
  )
}
