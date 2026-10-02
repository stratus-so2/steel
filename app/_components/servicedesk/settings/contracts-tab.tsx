'use client'

import {
  Calendar03Icon,
  PencilEdit02Icon,
  PlusSignIcon,
  Search01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  useCreateSdContract,
  useDeleteSdContract,
  useSdContracts,
  useUpdateSdContract,
} from '@/src/hooks/use-sd-contracts'
import type { SdContractDTO } from '@/types/sd-contract'
import { SdContractFormDialog } from '../contracts/sd-contract-form-dialog'
import {
  formatSdAllowance,
  formatSdMinutes,
  SD_BILLING_CYCLE_LABEL,
  SD_CONTRACT_STATUS_LABEL,
  SD_CONTRACT_STATUS_TONE,
} from '../contracts/sd-contract-labels'
import { SdContractPeriodsDialog } from '../contracts/sd-contract-periods-dialog'
import { formatBRL, formatDate } from '../ticket/shared/sd-tab-format'
import {
  ConfirmDeleteButton,
  EmptyState,
  SettingsSection,
  useSdSettingsContext,
} from './sd-settings-kit'

/**
 * Aba "Contratos" das configurações: contratos de atendimento do workspace
 * com franquia, valor da hora, regras de valor e o histórico de períodos.
 * Agentes veem; só admins do módulo editam.
 */
export function SdContractsTab() {
  const { workspaceId, canEdit } = useSdSettingsContext()
  const [q, setQ] = useState('')
  const query = useSdContracts(workspaceId, { q: q.trim() || undefined })
  const create = useCreateSdContract(workspaceId)
  const update = useUpdateSdContract(workspaceId)
  const remove = useDeleteSdContract(workspaceId)
  const [editing, setEditing] = useState<{
    contract: SdContractDTO | null
  } | null>(null)
  const [periodsOf, setPeriodsOf] = useState<SdContractDTO | null>(null)

  const contracts = query.data ?? []

  return (
    <SettingsSection
      title='Contratos de atendimento'
      description='Franquia de horas, valor da hora, arredondamento e as regras que decidem quanto custa cada apontamento. O apontamento de horas fica na aba "Horas" do chamado.'
      actions={
        canEdit ? (
          <Button size='sm' onClick={() => setEditing({ contract: null })}>
            <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
            Novo contrato
          </Button>
        ) : null
      }
    >
      <div className='relative'>
        <SteelIcon
          icon={Search01Icon}
          strokeWidth={2}
          className='pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground'
        />
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder='Buscar por contrato, código ou cliente'
          className='pl-9'
        />
      </div>

      {query.error ? (
        <EmptyState>{query.error.message}</EmptyState>
      ) : !query.isLoading && contracts.length === 0 ? (
        <EmptyState>
          {q
            ? 'Nenhum contrato encontrado.'
            : 'Nenhum contrato cadastrado. Sem contrato, o apontamento de horas vira só registro de tempo, sem valor.'}
        </EmptyState>
      ) : (
        <div className='overflow-x-auto rounded-lg border border-border'>
          <table className='w-full text-sm'>
            <thead className='bg-muted/50 text-left text-muted-foreground text-xs'>
              <tr>
                <th className='px-3 py-2 font-medium'>Contrato</th>
                <th className='px-3 py-2 font-medium'>Cliente</th>
                <th className='px-3 py-2 font-medium'>Vigência</th>
                <th className='px-3 py-2 font-medium'>Ciclo</th>
                <th className='px-3 py-2 text-right font-medium'>Franquia</th>
                <th className='px-3 py-2 text-right font-medium'>Hora</th>
                <th className='px-3 py-2 text-right font-medium'>
                  Período atual
                </th>
                <th className='w-28 px-3 py-2' />
              </tr>
            </thead>
            <tbody>
              {contracts.map((contract) => (
                <tr
                  key={contract.id}
                  className={cn(
                    'border-border border-t',
                    contract.status === 'ENDED' && 'opacity-60',
                  )}
                >
                  <td className='max-w-56 px-3 py-2'>
                    <div className='truncate font-medium'>{contract.name}</div>
                    <div className='flex items-center gap-1.5 text-muted-foreground text-xs'>
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.5 text-[11px]',
                          SD_CONTRACT_STATUS_TONE[contract.status],
                        )}
                      >
                        {SD_CONTRACT_STATUS_LABEL[contract.status]}
                      </span>
                      {contract.code ? (
                        <span className='font-mono'>{contract.code}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className='max-w-48 truncate px-3 py-2'>
                    {contract.customer.name}
                  </td>
                  <td className='whitespace-nowrap px-3 py-2 text-xs'>
                    {formatDate(contract.startsAt)}
                    {' → '}
                    {contract.endsAt ? formatDate(contract.endsAt) : 'sem fim'}
                  </td>
                  <td className='px-3 py-2'>
                    {SD_BILLING_CYCLE_LABEL[contract.billingCycle]}
                  </td>
                  <td className='px-3 py-2 text-right tabular-nums'>
                    {contract.includedMinutes > 0
                      ? formatSdMinutes(contract.includedMinutes)
                      : '—'}
                    {contract.carryOver ? (
                      <span className='block text-[11px] text-muted-foreground'>
                        acumula
                      </span>
                    ) : null}
                  </td>
                  <td className='px-3 py-2 text-right tabular-nums'>
                    {formatBRL(contract.hourlyRate)}
                    {contract.overtimeRate ? (
                      <span className='block text-[11px] text-muted-foreground'>
                        exc. {formatBRL(contract.overtimeRate)}
                      </span>
                    ) : null}
                  </td>
                  <td className='px-3 py-2 text-right tabular-nums'>
                    {contract.currentPeriod ? (
                      <>
                        {formatSdAllowance(
                          contract.currentPeriod.billableMinutes,
                          contract.currentPeriod.includedMinutes,
                        )}
                        <span className='block text-[11px] text-muted-foreground'>
                          {formatBRL(contract.currentPeriod.amount)}
                        </span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className='px-3 py-2'>
                    <div className='flex justify-end gap-0.5'>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon-xs'
                        aria-label={`Períodos de ${contract.name}`}
                        onClick={() => setPeriodsOf(contract)}
                      >
                        <SteelIcon icon={Calendar03Icon} strokeWidth={2} />
                      </Button>
                      {canEdit ? (
                        <>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon-xs'
                            aria-label={`Editar ${contract.name}`}
                            onClick={() => setEditing({ contract })}
                          >
                            <SteelIcon
                              icon={PencilEdit02Icon}
                              strokeWidth={2}
                            />
                          </Button>
                          <ConfirmDeleteButton
                            title='Excluir contrato'
                            description={`"${contract.name}" sai das listas e é marcado como encerrado. Os apontamentos já lançados continuam lá.`}
                            pending={remove.isPending}
                            onConfirm={() =>
                              remove.mutate(contract.id, {
                                onError: (error) => notify.error(error),
                              })
                            }
                          />
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <SdContractFormDialog
          key={editing.contract?.id ?? 'new'}
          workspaceId={workspaceId}
          open
          contract={editing.contract}
          pending={create.isPending || update.isPending}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          onSubmit={async (data) => {
            try {
              if (editing.contract) {
                await update.mutateAsync({ id: editing.contract.id, data })
                notify.success('Contrato salvo')
              } else {
                await create.mutateAsync(data)
                notify.success('Contrato criado')
              }
              setEditing(null)
            } catch (error) {
              notify.error(error)
            }
          }}
        />
      ) : null}

      <SdContractPeriodsDialog
        workspaceId={workspaceId}
        contract={periodsOf}
        canEdit={canEdit}
        onOpenChange={(open) => {
          if (!open) setPeriodsOf(null)
        }}
      />
    </SettingsSection>
  )
}
