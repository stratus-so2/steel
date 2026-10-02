'use client'

import { cn } from '@/lib/utils'
import { useSdCustomerContract } from '@/src/hooks/use-sd-contracts'
import { formatBRL, formatDate } from '../ticket/shared/sd-tab-format'
import {
  formatSdAllowance,
  formatSdMinutes,
  SD_BILLING_CYCLE_LABEL,
  SD_CONTRACT_STATUS_LABEL,
  SD_CONTRACT_STATUS_TONE,
} from './sd-contract-labels'

/**
 * Bloco do contrato vigente na tela do cliente: vigência, franquia e o
 * consumo do período corrente (com excedente e valor apurado).
 */
export function SdCustomerContractBlock({
  workspaceId,
  customerId,
}: {
  workspaceId: string
  customerId: string
}) {
  const query = useSdCustomerContract(workspaceId, customerId)

  if (query.isLoading) {
    return (
      <p className='py-8 text-center text-muted-foreground text-sm'>
        Carregando o contrato…
      </p>
    )
  }
  if (query.error) {
    return (
      <p className='py-8 text-center text-muted-foreground text-sm'>
        {query.error.message}
      </p>
    )
  }

  const contract = query.data?.contract ?? null
  if (!contract) {
    return (
      <p className='py-8 text-center text-muted-foreground text-sm'>
        Este cliente não tem contrato de atendimento vigente. Cadastre em
        Configurações &gt; Contratos.
      </p>
    )
  }

  const period = query.data?.period ?? null
  const percent = query.data?.percentUsed ?? null

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-col gap-1.5 rounded-lg border border-border bg-card p-4'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='font-medium text-sm'>{contract.name}</span>
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[11px]',
              SD_CONTRACT_STATUS_TONE[contract.status],
            )}
          >
            {SD_CONTRACT_STATUS_LABEL[contract.status]}
          </span>
          {contract.code ? (
            <span className='font-mono text-muted-foreground text-xs'>
              {contract.code}
            </span>
          ) : null}
        </div>
        <p className='text-muted-foreground text-xs'>
          {SD_BILLING_CYCLE_LABEL[contract.billingCycle]} ·{' '}
          {formatDate(contract.startsAt)} →{' '}
          {contract.endsAt ? formatDate(contract.endsAt) : 'sem fim'} ·{' '}
          {contract.includedMinutes > 0
            ? `franquia de ${formatSdMinutes(contract.includedMinutes)}`
            : 'sem franquia'}{' '}
          · hora {formatBRL(contract.hourlyRate)}
          {contract.overtimeRate
            ? ` (excedente ${formatBRL(contract.overtimeRate)})`
            : ''}
        </p>
        {contract.ticketTypes.length > 0 ? (
          <p className='text-muted-foreground text-xs'>
            Cobre apenas: {contract.ticketTypes.join(', ')}
          </p>
        ) : null}
      </div>

      {period ? (
        <div className='flex flex-col gap-2 rounded-lg border border-border bg-card p-4'>
          <div className='flex items-baseline justify-between gap-2'>
            <span className='font-medium text-sm'>
              Período de {formatDate(period.periodStart)}
            </span>
            <span className='font-semibold text-base tabular-nums'>
              {formatBRL(period.amount)}
            </span>
          </div>
          <p className='text-muted-foreground text-xs'>
            {formatSdAllowance(period.billableMinutes, period.includedMinutes)}
            {period.overageMinutes > 0
              ? ` · ${formatSdMinutes(period.overageMinutes)} de excedente`
              : ''}
            {period.carriedMinutes > 0
              ? ` · ${formatSdMinutes(period.carriedMinutes)} acumulam`
              : ''}
          </p>
          {percent === null ? null : (
            <div
              className='h-2 w-full overflow-hidden rounded-full bg-muted'
              role='progressbar'
              aria-label='Franquia consumida'
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  percent >= 100 ? 'bg-rose-500' : 'bg-primary',
                )}
                style={{ width: `${Math.min(percent, 100)}%` }}
              />
            </div>
          )}
          {percent === null ? null : (
            <span className='text-[11px] text-muted-foreground tabular-nums'>
              {percent}% da franquia
            </span>
          )}
        </div>
      ) : (
        <p className='text-muted-foreground text-xs'>
          O período deste ciclo ainda não foi aberto.
        </p>
      )}
    </div>
  )
}
