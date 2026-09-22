'use client'

import {
  PencilEdit02Icon,
  PlusSignIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  type SdTicketPartInput,
  useCreateSdTicketPart,
  useDeleteSdTicketPart,
  useSdTicketParts,
  useUpdateSdTicketPart,
} from '@/src/hooks/use-sd-ticket-parts'
import { useSdTicketRealtime } from '@/src/hooks/use-sd-tickets'
import type { SdPartStatusDTO, SdTicketPartDTO } from '@/types/sd-ticket-part'
import { ConfirmDeleteButton, EmptyState } from '../../settings/sd-settings-kit'
import {
  SD_PART_STATUS_LABEL,
  SdPartFormDialog,
} from '../parts/sd-part-form-dialog'
import { SdNativeSelect } from '../shared/sd-native-select'
import { SdAgentOnlyNotice, SdSummaryCard } from '../shared/sd-tab-bits'
import { formatBRL } from '../shared/sd-tab-format'
import type { SdTicketTabProps } from './types'

const STATUS_STYLE: Record<SdPartStatusDTO, string> = {
  REQUESTED: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  RESERVED: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  INSTALLED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  RETURNED: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  CANCELED: 'bg-muted text-muted-foreground',
}

type DialogState = { part: SdTicketPartDTO | null } | null

/** Peças do chamado (catálogo ou texto livre) com fluxo de status e estoque. */
export function SdTicketPartsTab({
  workspaceId,
  ticket,
  mode,
}: SdTicketTabProps) {
  const ticketRef = ticket.id
  const isAgent = mode === 'agent'
  useSdTicketRealtime(isAgent ? workspaceId : undefined)
  const query = useSdTicketParts(isAgent ? workspaceId : '', ticketRef)
  const create = useCreateSdTicketPart(workspaceId, ticketRef)
  const update = useUpdateSdTicketPart(workspaceId, ticketRef)
  const remove = useDeleteSdTicketPart(workspaceId, ticketRef)
  const [dialog, setDialog] = useState<DialogState>(null)

  if (!isAgent) return <SdAgentOnlyNotice />

  const items = query.data?.items ?? []
  const summary = query.data?.summary

  function changeStatus(part: SdTicketPartDTO, status: SdPartStatusDTO) {
    if (status === part.status) return
    update.mutate(
      { id: part.id, data: { status } },
      {
        onSuccess: () =>
          notify.success(
            `${part.name}: ${SD_PART_STATUS_LABEL[status].toLowerCase()}`,
          ),
        onError: (error) => notify.error(error),
      },
    )
  }

  async function submit(data: SdTicketPartInput) {
    try {
      if (dialog?.part) {
        const { partId: _ignored, status: _status, ...rest } = data
        await update.mutateAsync({ id: dialog.part.id, data: rest })
      } else {
        await create.mutateAsync(data)
      }
      setDialog(null)
    } catch (error) {
      notify.error(error)
    }
  }

  return (
    <div className='flex flex-col gap-4 p-4'>
      <div className='flex items-center justify-between gap-2'>
        <h3 className='font-medium text-sm'>Peças utilizadas</h3>
        <Button size='sm' onClick={() => setDialog({ part: null })}>
          <SteelIcon icon={PlusSignIcon} />
          Adicionar peça
        </Button>
      </div>

      {summary ? (
        <div className='grid grid-cols-1 gap-2 sm:grid-cols-3'>
          <SdSummaryCard
            label='Total (ativas)'
            value={formatBRL(summary.total)}
          />
          <SdSummaryCard
            label='Instaladas'
            value={formatBRL(summary.installed)}
          />
          <SdSummaryCard label='Itens ativos' value={String(summary.count)} />
        </div>
      ) : null}

      {query.error ? (
        <EmptyState>{query.error.message}</EmptyState>
      ) : !query.isLoading && items.length === 0 ? (
        <EmptyState>Nenhuma peça neste chamado.</EmptyState>
      ) : (
        <div className='overflow-x-auto rounded-lg border border-border'>
          <table className='w-full text-sm'>
            <thead className='bg-muted/50 text-left text-muted-foreground text-xs'>
              <tr>
                <th className='px-3 py-2 font-medium'>Peça</th>
                <th className='px-3 py-2 font-medium'>Série</th>
                <th className='px-3 py-2 text-right font-medium'>Qtd.</th>
                <th className='px-3 py-2 text-right font-medium'>Unitário</th>
                <th className='px-3 py-2 text-right font-medium'>Total</th>
                <th className='px-3 py-2 font-medium'>Status</th>
                <th className='w-16 px-3 py-2' />
              </tr>
            </thead>
            <tbody>
              {items.map((part) => {
                const inactive =
                  part.status === 'CANCELED' || part.status === 'RETURNED'
                return (
                  <tr
                    key={part.id}
                    className={cn(
                      'border-border border-t',
                      inactive && 'opacity-60',
                    )}
                  >
                    <td className='max-w-64 px-3 py-2'>
                      <div className='truncate font-medium'>{part.name}</div>
                      <div className='flex gap-2 text-muted-foreground text-xs'>
                        {part.sku ? (
                          <span className='font-mono'>{part.sku}</span>
                        ) : null}
                        {part.partId ? (
                          <span>
                            Catálogo
                            {part.catalogStock != null
                              ? ` · estoque ${part.catalogStock}`
                              : ''}
                          </span>
                        ) : (
                          <span>Texto livre</span>
                        )}
                      </div>
                      {part.notes ? (
                        <div className='truncate text-muted-foreground text-xs'>
                          {part.notes}
                        </div>
                      ) : null}
                    </td>
                    <td className='px-3 py-2 font-mono text-xs'>
                      {part.serialNumber ?? '—'}
                    </td>
                    <td className='px-3 py-2 text-right tabular-nums'>
                      {part.quantity}
                    </td>
                    <td className='px-3 py-2 text-right tabular-nums'>
                      {formatBRL(part.unitCost)}
                    </td>
                    <td className='px-3 py-2 text-right font-medium tabular-nums'>
                      {formatBRL(part.total)}
                    </td>
                    <td className='px-3 py-2'>
                      {part.nextStatuses.length > 0 ? (
                        <SdNativeSelect
                          label={`Status de ${part.name}`}
                          value={part.status}
                          disabled={update.isPending}
                          options={[part.status, ...part.nextStatuses].map(
                            (s) => ({
                              value: s,
                              label: SD_PART_STATUS_LABEL[s],
                            }),
                          )}
                          onChange={(s) => changeStatus(part, s)}
                        />
                      ) : (
                        <Badge className={STATUS_STYLE[part.status]}>
                          {SD_PART_STATUS_LABEL[part.status]}
                        </Badge>
                      )}
                    </td>
                    <td className='px-3 py-2'>
                      <div className='flex justify-end gap-0.5'>
                        <Button
                          size='icon-xs'
                          variant='ghost'
                          aria-label={`Editar ${part.name}`}
                          onClick={() => setDialog({ part })}
                        >
                          <SteelIcon icon={PencilEdit02Icon} />
                        </Button>
                        <ConfirmDeleteButton
                          title='Remover peça?'
                          description={`"${part.name}" será removida do chamado.`}
                          pending={remove.isPending}
                          onConfirm={() =>
                            remove.mutate(part.id, {
                              onError: (error) => notify.error(error),
                            })
                          }
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <SdPartFormDialog
        workspaceId={workspaceId}
        open={dialog !== null}
        part={dialog?.part ?? null}
        pending={create.isPending || update.isPending}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
        onSubmit={(data) => void submit(data)}
      />
    </div>
  )
}
