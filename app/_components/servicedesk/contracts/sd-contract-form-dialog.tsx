'use client'

import { Delete02Icon, PlusSignIcon } from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { SdContractInput } from '@/src/hooks/use-sd-contracts'
import type { SdTicketTypeDTO } from '@/types/sd-config'
import type { SdContractDTO, SdRateWindowDTO } from '@/types/sd-contract'
import type { SdOptionDTO } from '@/types/sd-directory'
import { SdCustomerPicker } from '../pickers'
import {
  FieldBlock,
  SD_TICKET_TYPE_OPTIONS,
  SimpleSelect,
  TicketTypeToggles,
  ToggleRow,
  useSdSettingsContext,
} from '../settings/sd-settings-kit'
import {
  SD_BILLING_CYCLE_OPTIONS,
  SD_CONTRACT_STATUS_OPTIONS,
  SD_RATE_WINDOW_OPTIONS,
} from './sd-contract-labels'

/**
 * Cadastro do contrato de atendimento: vigência, ciclo, franquia, valor da
 * hora, arredondamento, mínimo por chamado, tipos cobertos e a tabela de
 * valores (tipo × prioridade × janela).
 */

interface RateRow {
  key: string
  ticketType: SdTicketTypeDTO | null
  priorityId: string | null
  window: SdRateWindowDTO
  hourlyRate: string
  multiplier: string
}

/** `"1.234,50"` / `"1234.5"` → número; NaN quando inválido. */
function toNumber(value: string): number {
  const text = value.trim()
  if (!text) return Number.NaN
  return Number(
    text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text,
  )
}

function moneyInput(value: string): string {
  return value.replace('.', ',')
}

/** Minutos → horas em texto (`90` → `"1,5"`). */
function minutesToHours(minutes: number): string {
  if (minutes <= 0) return ''
  return String(minutes / 60).replace('.', ',')
}

function toDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : ''
}

function fromDateInput(value: string): string | null {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : null
}

export function SdContractFormDialog({
  workspaceId,
  open,
  contract,
  pending,
  onOpenChange,
  onSubmit,
}: {
  workspaceId: string
  open: boolean
  /** `null` = novo contrato. */
  contract: SdContractDTO | null
  pending: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: SdContractInput) => void
}) {
  const { config } = useSdSettingsContext()
  const [customer, setCustomer] = useState<SdOptionDTO | null>(
    contract
      ? {
          id: contract.customer.id,
          label: contract.customer.name,
          sublabel: contract.customer.tradeName,
        }
      : null,
  )
  const [name, setName] = useState(contract?.name ?? '')
  const [code, setCode] = useState(contract?.code ?? '')
  const [status, setStatus] = useState(contract?.status ?? 'DRAFT')
  const [startsAt, setStartsAt] = useState(
    toDateInput(contract?.startsAt ?? new Date().toISOString()),
  )
  const [endsAt, setEndsAt] = useState(toDateInput(contract?.endsAt ?? null))
  const [billingCycle, setBillingCycle] = useState(
    contract?.billingCycle ?? 'MONTHLY',
  )
  const [includedHours, setIncludedHours] = useState(
    minutesToHours(contract?.includedMinutes ?? 0),
  )
  const [carryOver, setCarryOver] = useState(contract?.carryOver ?? false)
  const [hourlyRate, setHourlyRate] = useState(
    moneyInput(contract?.hourlyRate ?? '0,00'),
  )
  const [overtimeRate, setOvertimeRate] = useState(
    contract?.overtimeRate ? moneyInput(contract.overtimeRate) : '',
  )
  const [roundingMinutes, setRoundingMinutes] = useState(
    String(contract?.roundingMinutes ?? 15),
  )
  const [minimumMinutes, setMinimumMinutes] = useState(
    String(contract?.minimumMinutes ?? 0),
  )
  const [ticketTypes, setTicketTypes] = useState<SdTicketTypeDTO[]>(
    contract?.ticketTypes ?? [],
  )
  const [slaPolicyId, setSlaPolicyId] = useState(contract?.slaPolicyId ?? null)
  const [notes, setNotes] = useState(contract?.notes ?? '')
  const [rates, setRates] = useState<RateRow[]>(
    (contract?.rates ?? []).map((rate, index) => ({
      key: `${rate.id}-${index}`,
      ticketType: rate.ticketType,
      priorityId: rate.priorityId,
      window: rate.window,
      hourlyRate: moneyInput(rate.hourlyRate),
      multiplier: moneyInput(rate.multiplier),
    })),
  )

  const hourly = toNumber(hourlyRate)
  const overtime = overtimeRate.trim() ? toNumber(overtimeRate) : null
  const included = includedHours.trim() ? toNumber(includedHours) : 0
  const rounding = Number(roundingMinutes)
  const minimum = Number(minimumMinutes)
  const ratesValid = rates.every(
    (rate) =>
      Number.isFinite(toNumber(rate.hourlyRate)) &&
      toNumber(rate.hourlyRate) >= 0 &&
      Number.isFinite(toNumber(rate.multiplier)) &&
      toNumber(rate.multiplier) >= 0.01,
  )
  const valid =
    Boolean(customer) &&
    name.trim().length > 0 &&
    Boolean(startsAt) &&
    (!endsAt || endsAt > startsAt) &&
    Number.isFinite(hourly) &&
    hourly >= 0 &&
    (overtime === null || (Number.isFinite(overtime) && overtime >= 0)) &&
    Number.isFinite(included) &&
    included >= 0 &&
    Number.isInteger(rounding) &&
    rounding >= 1 &&
    rounding <= 480 &&
    Number.isInteger(minimum) &&
    minimum >= 0 &&
    minimum <= 1440 &&
    ratesValid

  const priorityOptions = (config?.priorities ?? []).map((priority) => ({
    value: priority.id,
    label: priority.name,
  }))
  const slaOptions = (config?.slaPolicies ?? [])
    .filter((policy) => policy.active)
    .map((policy) => ({ value: policy.id, label: policy.name }))

  function submit() {
    if (!customer) return
    onSubmit({
      customerId: customer.id,
      name: name.trim(),
      code: code.trim() || null,
      status,
      startsAt: fromDateInput(startsAt) ?? new Date().toISOString(),
      endsAt: fromDateInput(endsAt),
      billingCycle,
      includedMinutes: Math.round(included * 60),
      carryOver,
      hourlyRate: hourly.toFixed(2),
      overtimeRate: overtime === null ? null : overtime.toFixed(2),
      roundingMinutes: rounding,
      minimumMinutes: minimum,
      ticketTypes,
      slaPolicyId,
      notes: notes.trim() || null,
      rates: rates.map((rate) => ({
        ticketType: rate.ticketType,
        priorityId: rate.priorityId,
        window: rate.window,
        hourlyRate: toNumber(rate.hourlyRate).toFixed(2),
        multiplier: toNumber(rate.multiplier).toFixed(2),
      })),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[90vh] flex-col sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>
            {contract ? 'Editar contrato' : 'Novo contrato'}
          </DialogTitle>
          <DialogDescription>
            A franquia e o valor da hora valem para todo o contrato; a tabela de
            valores sobrepõe por tipo, prioridade e janela.
          </DialogDescription>
        </DialogHeader>

        <div className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1'>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <FieldBlock label='Cliente'>
              <SdCustomerPicker
                workspaceId={workspaceId}
                value={customer?.id ?? null}
                selectedLabel={customer?.label ?? null}
                onChange={setCustomer}
              />
            </FieldBlock>
            <FieldBlock label='Nome do contrato'>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                placeholder='Suporte mensal 20 h'
              />
            </FieldBlock>
          </div>

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
            <FieldBlock label='Código' hint='Opcional, para o financeiro.'>
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                maxLength={64}
              />
            </FieldBlock>
            <FieldBlock label='Situação'>
              <SimpleSelect
                value={status}
                onChange={(next) => setStatus(next ?? 'DRAFT')}
                options={SD_CONTRACT_STATUS_OPTIONS}
              />
            </FieldBlock>
            <FieldBlock label='Ciclo de faturamento'>
              <SimpleSelect
                value={billingCycle}
                onChange={(next) => setBillingCycle(next ?? 'MONTHLY')}
                options={SD_BILLING_CYCLE_OPTIONS}
              />
            </FieldBlock>
          </div>

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <FieldBlock label='Início da vigência'>
              <Input
                type='date'
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
              />
            </FieldBlock>
            <FieldBlock label='Término' hint='Vazio = sem data de término.'>
              <Input
                type='date'
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                aria-invalid={Boolean(endsAt) && endsAt <= startsAt}
              />
            </FieldBlock>
          </div>

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <FieldBlock
              label='Franquia do período (horas)'
              hint='Vazio ou 0 = sem franquia, tudo é cobrado.'
            >
              <Input
                value={includedHours}
                inputMode='decimal'
                onChange={(event) => setIncludedHours(event.target.value)}
                placeholder='20'
              />
            </FieldBlock>
            <FieldBlock label='Valor da hora (R$)'>
              <Input
                value={hourlyRate}
                inputMode='decimal'
                onChange={(event) => setHourlyRate(event.target.value)}
                aria-invalid={!Number.isFinite(hourly) || hourly < 0}
              />
            </FieldBlock>
          </div>

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
            <FieldBlock
              label='Hora excedente (R$)'
              hint='Vazio = o mesmo valor da hora.'
            >
              <Input
                value={overtimeRate}
                inputMode='decimal'
                onChange={(event) => setOvertimeRate(event.target.value)}
              />
            </FieldBlock>
            <FieldBlock
              label='Arredondamento (min)'
              hint='15 = cobra em blocos de 15 min, sempre para cima.'
            >
              <Input
                value={roundingMinutes}
                inputMode='numeric'
                onChange={(event) => setRoundingMinutes(event.target.value)}
                aria-invalid={!Number.isInteger(rounding) || rounding < 1}
              />
            </FieldBlock>
            <FieldBlock
              label='Mínimo por chamado (min)'
              hint='Vale no primeiro apontamento do dia naquele chamado.'
            >
              <Input
                value={minimumMinutes}
                inputMode='numeric'
                onChange={(event) => setMinimumMinutes(event.target.value)}
                aria-invalid={!Number.isInteger(minimum) || minimum < 0}
              />
            </FieldBlock>
          </div>

          <ToggleRow
            label='Acumular a franquia que sobrar'
            description='O saldo não usado entra na franquia do período seguinte.'
            checked={carryOver}
            onCheckedChange={setCarryOver}
          />

          <FieldBlock label='Tipos cobertos'>
            <TicketTypeToggles
              value={ticketTypes}
              onChange={setTicketTypes}
              emptyLabel='cobre todos os tipos'
            />
          </FieldBlock>

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <FieldBlock
              label='SLA prometido'
              hint='Define o calendário usado para a janela do apontamento.'
            >
              <SimpleSelect
                value={slaPolicyId}
                onChange={setSlaPolicyId}
                options={slaOptions}
                allowEmpty
                emptyLabel='Calendário padrão'
              />
            </FieldBlock>
            <FieldBlock label='Observações'>
              <Textarea
                value={notes}
                rows={2}
                onChange={(event) => setNotes(event.target.value)}
              />
            </FieldBlock>
          </div>

          <section className='flex flex-col gap-2 rounded-lg border border-border p-3'>
            <header className='flex items-center justify-between gap-2'>
              <div className='flex flex-col'>
                <h4 className='font-medium text-sm'>Tabela de valores</h4>
                <p className='text-[11px] text-muted-foreground'>
                  A primeira linha que casar vence (de cima para baixo). Deixe o
                  tipo e a prioridade em branco para valer para todos.
                </p>
              </div>
              <Button
                type='button'
                size='sm'
                variant='outline'
                onClick={() =>
                  setRates((current) => [
                    ...current,
                    {
                      key: `new-${current.length}-${Date.now()}`,
                      ticketType: null,
                      priorityId: null,
                      window: 'AFTER_HOURS',
                      hourlyRate: hourlyRate || '0,00',
                      multiplier: '1,00',
                    },
                  ])
                }
              >
                <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
                Nova regra
              </Button>
            </header>

            {rates.length === 0 ? (
              <p className='py-3 text-center text-muted-foreground text-xs'>
                Sem regras: vale o valor da hora do contrato em qualquer janela.
              </p>
            ) : (
              <ul className='flex flex-col gap-2'>
                {rates.map((rate, index) => (
                  <li
                    key={rate.key}
                    className='grid grid-cols-2 items-end gap-2 rounded-md bg-muted/40 p-2 sm:grid-cols-[1fr_1fr_1fr_auto_auto_auto]'
                  >
                    <FieldBlock label='Tipo'>
                      <SimpleSelect
                        value={rate.ticketType}
                        onChange={(next) =>
                          setRates((current) =>
                            current.map((row, i) =>
                              i === index ? { ...row, ticketType: next } : row,
                            ),
                          )
                        }
                        options={SD_TICKET_TYPE_OPTIONS.map((option) => ({
                          value: option.value,
                          label: option.label,
                        }))}
                        allowEmpty
                        emptyLabel='Todos'
                      />
                    </FieldBlock>
                    <FieldBlock label='Prioridade'>
                      <SimpleSelect
                        value={rate.priorityId}
                        onChange={(next) =>
                          setRates((current) =>
                            current.map((row, i) =>
                              i === index ? { ...row, priorityId: next } : row,
                            ),
                          )
                        }
                        options={priorityOptions}
                        allowEmpty
                        emptyLabel='Todas'
                      />
                    </FieldBlock>
                    <FieldBlock label='Janela'>
                      <SimpleSelect
                        value={rate.window}
                        onChange={(next) =>
                          setRates((current) =>
                            current.map((row, i) =>
                              i === index
                                ? { ...row, window: next ?? 'BUSINESS_HOURS' }
                                : row,
                            ),
                          )
                        }
                        options={SD_RATE_WINDOW_OPTIONS}
                      />
                    </FieldBlock>
                    <FieldBlock label='Hora (R$)' className='w-28'>
                      <Input
                        value={rate.hourlyRate}
                        inputMode='decimal'
                        onChange={(event) =>
                          setRates((current) =>
                            current.map((row, i) =>
                              i === index
                                ? { ...row, hourlyRate: event.target.value }
                                : row,
                            ),
                          )
                        }
                        aria-invalid={
                          !Number.isFinite(toNumber(rate.hourlyRate))
                        }
                      />
                    </FieldBlock>
                    <FieldBlock label='Multiplicador' className='w-28'>
                      <Input
                        value={rate.multiplier}
                        inputMode='decimal'
                        onChange={(event) =>
                          setRates((current) =>
                            current.map((row, i) =>
                              i === index
                                ? { ...row, multiplier: event.target.value }
                                : row,
                            ),
                          )
                        }
                        aria-invalid={
                          !Number.isFinite(toNumber(rate.multiplier))
                        }
                      />
                    </FieldBlock>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon-sm'
                      aria-label={`Remover a regra ${index + 1}`}
                      className='text-muted-foreground hover:text-destructive'
                      onClick={() =>
                        setRates((current) =>
                          current.filter((_row, i) => i !== index),
                        )
                      }
                    >
                      <SteelIcon icon={Delete02Icon} strokeWidth={2} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            size='sm'
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button size='sm' disabled={!valid || pending} onClick={submit}>
            {pending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
