'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { notify } from '@/lib/notify'
import {
  useCloseSdContractPeriod,
  useSdContractPeriods,
} from '@/src/hooks/use-sd-contracts'
import type { SdContractDTO } from '@/types/sd-contract'
import { EmptyState } from '../settings/sd-settings-kit'
import { formatBRL, formatDate } from '../ticket/shared/sd-tab-format'
import {
  formatSdAllowance,
  formatSdMinutes,
  SD_PERIOD_STATUS_LABEL,
} from './sd-contract-labels'

/**
 * Histórico de períodos do contrato: franquia, consumo, excedente, saldo
 * acumulado e valor apurado, com o fechamento manual do período aberto.
 */
export function SdContractPeriodsDialog({
  workspaceId,
  contract,
  canEdit,
  onOpenChange,
}: {
  workspaceId: string
  /** `null` = fechado. */
  contract: SdContractDTO | null
  canEdit: boolean
  onOpenChange: (open: boolean) => void
}) {
  const query = useSdContractPeriods(workspaceId, contract?.id ?? null)
  const close = useCloseSdContractPeriod(workspaceId)
  const periods = query.data ?? []

  return (
    <Dialog open={Boolean(contract)} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[85vh] flex-col sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>Períodos de {contract?.name}</DialogTitle>
          <DialogDescription>
            O worker abre o período no primeiro dia do ciclo e fecha o anterior.
            Fechar à mão consolida os apontamentos e congela o período.
          </DialogDescription>
        </DialogHeader>

        <div className='min-h-0 flex-1 overflow-y-auto'>
          {query.error ? (
            <EmptyState>{query.error.message}</EmptyState>
          ) : !query.isLoading && periods.length === 0 ? (
            <EmptyState>
              Nenhum período ainda. O primeiro abre no próximo apontamento ou no
              tick diário de faturamento.
            </EmptyState>
          ) : (
            <table className='w-full text-sm'>
              <thead className='bg-muted/50 text-left text-muted-foreground text-xs'>
                <tr>
                  <th className='px-3 py-2 font-medium'>Período</th>
                  <th className='px-3 py-2 font-medium'>Situação</th>
                  <th className='px-3 py-2 text-right font-medium'>Consumo</th>
                  <th className='px-3 py-2 text-right font-medium'>
                    Excedente
                  </th>
                  <th className='px-3 py-2 text-right font-medium'>
                    Acumulado
                  </th>
                  <th className='px-3 py-2 text-right font-medium'>Valor</th>
                  <th className='px-3 py-2' />
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => (
                  <tr key={period.id} className='border-border border-t'>
                    <td className='whitespace-nowrap px-3 py-2'>
                      {formatDate(period.periodStart)}
                    </td>
                    <td className='px-3 py-2'>
                      {SD_PERIOD_STATUS_LABEL[period.status]}
                      {period.closedAt ? (
                        <span className='block text-[11px] text-muted-foreground'>
                          {formatDate(period.closedAt)}
                          {period.closedBy
                            ? ` · ${period.closedBy.name}`
                            : ' · automático'}
                        </span>
                      ) : null}
                    </td>
                    <td className='px-3 py-2 text-right tabular-nums'>
                      {formatSdAllowance(
                        period.billableMinutes,
                        period.includedMinutes,
                      )}
                      {period.usedMinutes !== period.billableMinutes ? (
                        <span className='block text-[11px] text-muted-foreground'>
                          {formatSdMinutes(period.usedMinutes)} apontados
                        </span>
                      ) : null}
                    </td>
                    <td className='px-3 py-2 text-right tabular-nums'>
                      {period.overageMinutes > 0
                        ? formatSdMinutes(period.overageMinutes)
                        : '—'}
                    </td>
                    <td className='px-3 py-2 text-right tabular-nums'>
                      {period.carriedMinutes > 0
                        ? formatSdMinutes(period.carriedMinutes)
                        : '—'}
                    </td>
                    <td className='px-3 py-2 text-right font-medium tabular-nums'>
                      {formatBRL(period.amount)}
                    </td>
                    <td className='px-3 py-2 text-right'>
                      {canEdit && period.status === 'OPEN' && contract ? (
                        <Button
                          size='sm'
                          variant='outline'
                          disabled={close.isPending}
                          onClick={() =>
                            close.mutate(
                              { contractId: contract.id, periodId: period.id },
                              {
                                onSuccess: () =>
                                  notify.success('Período fechado.'),
                                onError: (error) => notify.error(error),
                              },
                            )
                          }
                        >
                          Fechar
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            size='sm'
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
