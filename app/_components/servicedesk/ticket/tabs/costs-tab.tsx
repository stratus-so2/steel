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
import {
  type SdTicketCostInput,
  useCreateSdTicketCost,
  useDeleteSdTicketCost,
  useSdTicketCosts,
  useUpdateSdTicketCost,
} from '@/src/hooks/use-sd-ticket-costs'
import { useSdTicketRealtime } from '@/src/hooks/use-sd-tickets'
import type { SdTicketCostDTO } from '@/types/sd-ticket-cost'
import { ConfirmDeleteButton, EmptyState } from '../../settings/sd-settings-kit'
import {
  SD_COST_CATEGORY_LABEL,
  SdCostFormDialog,
} from '../costs/sd-cost-form-dialog'
import { SdAgentOnlyNotice, SdSummaryCard } from '../shared/sd-tab-bits'
import { formatBRL, formatDate, formatQuantity } from '../shared/sd-tab-format'
import type { SdTicketTabProps } from './types'

type DialogState = { cost: SdTicketCostDTO | null } | null

/** Custos do chamado com totais por categoria e faturável × interno. */
export function SdTicketCostsTab({
  workspaceId,
  ticket,
  mode,
}: SdTicketTabProps) {
  const ticketRef = ticket.id
  const isAgent = mode === 'agent'
  useSdTicketRealtime(isAgent ? workspaceId : undefined)
  const query = useSdTicketCosts(isAgent ? workspaceId : '', ticketRef)
  const create = useCreateSdTicketCost(workspaceId, ticketRef)
  const update = useUpdateSdTicketCost(workspaceId, ticketRef)
  const remove = useDeleteSdTicketCost(workspaceId, ticketRef)
  const [dialog, setDialog] = useState<DialogState>(null)

  if (!isAgent) return <SdAgentOnlyNotice />

  const items = query.data?.items ?? []
  const summary = query.data?.summary

  async function submit(
    data: SdTicketCostInput & { description: string; unitCost: string },
  ) {
    try {
      if (dialog?.cost) {
        await update.mutateAsync({ id: dialog.cost.id, data })
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
        <h3 className='font-medium text-sm'>Custos do atendimento</h3>
        <Button size='sm' onClick={() => setDialog({ cost: null })}>
          <SteelIcon icon={PlusSignIcon} />
          Lançar custo
        </Button>
      </div>

      {summary ? (
        <div className='grid grid-cols-1 gap-2 sm:grid-cols-3'>
          <SdSummaryCard label='Total' value={formatBRL(summary.total)} />
          <SdSummaryCard
            label='Faturável'
            value={formatBRL(summary.billable)}
            hint='Repassado ao cliente'
          />
          <SdSummaryCard
            label='Não faturável'
            value={formatBRL(summary.nonBillable)}
            hint='Custo interno'
          />
        </div>
      ) : null}

      {summary && summary.byCategory.length > 0 ? (
        <ul className='flex flex-wrap gap-2' aria-label='Totais por categoria'>
          {summary.byCategory.map((c) => (
            <li
              key={c.category}
              className='rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs'
            >
              {SD_COST_CATEGORY_LABEL[c.category]}:{' '}
              <strong className='tabular-nums'>{formatBRL(c.total)}</strong>
            </li>
          ))}
        </ul>
      ) : null}

      {query.error ? (
        <EmptyState>{query.error.message}</EmptyState>
      ) : !query.isLoading && items.length === 0 ? (
        <EmptyState>Nenhum custo lançado.</EmptyState>
      ) : (
        <div className='overflow-x-auto rounded-lg border border-border'>
          <table className='w-full text-sm'>
            <thead className='bg-muted/50 text-left text-muted-foreground text-xs'>
              <tr>
                <th className='px-3 py-2 font-medium'>Data</th>
                <th className='px-3 py-2 font-medium'>Descrição</th>
                <th className='px-3 py-2 font-medium'>Categoria</th>
                <th className='px-3 py-2 text-right font-medium'>Qtd.</th>
                <th className='px-3 py-2 text-right font-medium'>Unitário</th>
                <th className='px-3 py-2 text-right font-medium'>Total</th>
                <th className='w-16 px-3 py-2' />
              </tr>
            </thead>
            <tbody>
              {items.map((cost) => (
                <tr key={cost.id} className='border-border border-t'>
                  <td className='whitespace-nowrap px-3 py-2'>
                    {formatDate(cost.incurredAt)}
                  </td>
                  <td className='max-w-64 px-3 py-2'>
                    <div className='truncate font-medium'>
                      {cost.description}
                    </div>
                    <div className='flex items-center gap-1.5 text-muted-foreground text-xs'>
                      {cost.user ? <span>{cost.user.name}</span> : null}
                      {cost.billable ? (
                        <Badge variant='secondary'>Faturável</Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className='px-3 py-2'>
                    {SD_COST_CATEGORY_LABEL[cost.category]}
                  </td>
                  <td className='px-3 py-2 text-right tabular-nums'>
                    {formatQuantity(cost.quantity)}
                  </td>
                  <td className='px-3 py-2 text-right tabular-nums'>
                    {formatBRL(cost.unitCost)}
                  </td>
                  <td className='px-3 py-2 text-right font-medium tabular-nums'>
                    {formatBRL(cost.total)}
                  </td>
                  <td className='px-3 py-2'>
                    <div className='flex justify-end gap-0.5'>
                      <Button
                        size='icon-xs'
                        variant='ghost'
                        aria-label={`Editar ${cost.description}`}
                        onClick={() => setDialog({ cost })}
                      >
                        <SteelIcon icon={PencilEdit02Icon} />
                      </Button>
                      <ConfirmDeleteButton
                        title='Excluir custo?'
                        description={`"${cost.description}" será removido.`}
                        pending={remove.isPending}
                        onConfirm={() =>
                          remove.mutate(cost.id, {
                            onError: (error) => notify.error(error),
                          })
                        }
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SdCostFormDialog
        workspaceId={workspaceId}
        open={dialog !== null}
        cost={dialog?.cost ?? null}
        pending={create.isPending || update.isPending}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
        onSubmit={(data) => void submit(data)}
      />
    </div>
  )
}
