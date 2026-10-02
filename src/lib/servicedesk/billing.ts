import type {
  SdContractBillingCycle,
  SdRateWindow,
  SdTicketType,
} from '@prisma/client'
import { Prisma } from '@prisma/client'
import { SD_CALENDAR_24X7, SD_WEEKDAYS, type SdCalendar } from './sla'

/**
 * Cálculo financeiro dos contratos de atendimento. Lib **pura** (só `Intl` e
 * `Prisma.Decimal`), sem acesso a banco:
 *
 * 1. **janela** do apontamento pelo calendário de expediente do contrato
 *    (feriado > expediente > fim de semana > fora de hora);
 * 2. **minutos cobrados**: arredondamento para cima no múltiplo de
 *    `roundingMinutes` e, no primeiro apontamento do dia naquele chamado, o
 *    mínimo `minimumMinutes`;
 * 3. **regra de valor**: a primeira `SdContractRate` (ordem de `position`)
 *    cujo tipo/prioridade/janela casam — `null` é curinga; sem regra, vale o
 *    valor do contrato;
 * 4. **período**: a franquia (`includedMinutes` + saldo acumulado) cobre os
 *    minutos faturáveis na ordem cronológica; o que passa é excedente e é
 *    cobrado pela hora de excedente (`overtimeRate`, quando o contrato tem
 *    uma e o apontamento não casou com nenhuma regra específica).
 *
 * Dinheiro sempre em `Prisma.Decimal`; a serialização com 2 casas é do
 * mapper (`sdMoney`).
 */

const MINUTE_MS = 60_000

export type DecimalLike = Prisma.Decimal | string | number

const dec = (value: DecimalLike): Prisma.Decimal => new Prisma.Decimal(value)

const money = (value: Prisma.Decimal): Prisma.Decimal =>
  value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)

/* ------------------------------------------------------------------ */
/* Janela do apontamento                                               */
/* ------------------------------------------------------------------ */

/**
 * `"HH:MM"` em minutos desde a meia-noite. `parseSdCalendar` já descartou
 * horários malformados, então aqui não há o que validar.
 */
function minutesOf(value: string): number {
  const [hour, minute] = value.split(':')
  return Number(hour) * 60 + Number(minute)
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let fmt = formatters.get(timeZone)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    formatters.set(timeZone, fmt)
  }
  return fmt
}

interface LocalParts {
  year: number
  month: number
  day: number
  minutes: number
}

function localParts(at: Date, timeZone: string): LocalParts {
  const parts: Record<string, number> = {}
  for (const part of formatterFor(timeZone).formatToParts(at)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value)
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    minutes: parts.hour * 60 + parts.minute,
  }
}

function isoDate(p: LocalParts): string {
  return `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** `true` se `minutes` cai em alguma janela do dia (inclui a que cruza a meia-noite do dia anterior). */
function insideWindow(
  cal: SdCalendar,
  weekday: number,
  minutes: number,
): boolean {
  const today = cal.schedule[SD_WEEKDAYS[weekday]] ?? []
  for (const [from, to] of today) {
    const start = minutesOf(from)
    const end = minutesOf(to)
    if (start === end) continue
    const upper = end < start ? end + 24 * 60 : end
    if (minutes >= start && minutes < upper) return true
  }
  // Janela do dia anterior que atravessou a meia-noite (`["22:00","02:00"]`).
  const before = cal.schedule[SD_WEEKDAYS[(weekday + 6) % 7]] ?? []
  for (const [from, to] of before) {
    const end = minutesOf(to)
    if (end >= minutesOf(from)) continue
    if (minutes < end) return true
  }
  return false
}

/**
 * Janela de valor do instante `at` no calendário `cal`. Calendário 24×7 (ou
 * sem nenhuma janela de expediente) é sempre `BUSINESS_HOURS` — não existe
 * "fora de hora" num relógio corrido.
 */
export function resolveSdRateWindow(at: Date, cal: SdCalendar): SdRateWindow {
  const hasWindow = SD_WEEKDAYS.some(
    (day) => (cal.schedule[day]?.length ?? 0) > 0,
  )
  if (cal.is24x7 || !hasWindow) return 'BUSINESS_HOURS'

  const parts = localParts(at, cal.timezone)
  const date = isoDate(parts)
  if (cal.holidays.some((h) => h.date === date)) return 'HOLIDAY'

  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay()
  if (insideWindow(cal, weekday, parts.minutes)) return 'BUSINESS_HOURS'
  return weekday === 0 || weekday === 6 ? 'WEEKEND' : 'AFTER_HOURS'
}

/* ------------------------------------------------------------------ */
/* Minutos cobrados                                                     */
/* ------------------------------------------------------------------ */

/** Minutos corridos entre início e fim, no mínimo 1 (sempre para cima). */
export function sdElapsedMinutes(startedAt: Date, endedAt: Date): number {
  const ms = endedAt.getTime() - startedAt.getTime()
  if (ms <= 0) return 0
  return Math.max(1, Math.ceil(ms / MINUTE_MS))
}

/** Arredonda para cima no múltiplo de `step` (`step <= 1` não arredonda). */
export function roundSdMinutes(minutes: number, step: number): number {
  if (minutes <= 0) return 0
  if (!Number.isFinite(step) || step <= 1) return Math.ceil(minutes)
  return Math.ceil(minutes / step) * step
}

export interface SdBillingContract {
  includedMinutes: number
  carryOver: boolean
  hourlyRate: DecimalLike
  overtimeRate: DecimalLike | null
  roundingMinutes: number
  minimumMinutes: number
}

/**
 * Minutos do apontamento depois das regras do contrato: arredondamento e,
 * quando é o primeiro apontamento do dia naquele chamado, o mínimo por
 * chamado.
 */
export function sdBillableMinutes(
  rawMinutes: number,
  contract: Pick<SdBillingContract, 'roundingMinutes' | 'minimumMinutes'>,
  firstOfDayOnTicket: boolean,
): number {
  const rounded = roundSdMinutes(rawMinutes, contract.roundingMinutes)
  if (rounded <= 0) return 0
  if (!firstOfDayOnTicket) return rounded
  return Math.max(rounded, contract.minimumMinutes)
}

/* ------------------------------------------------------------------ */
/* Regra de valor                                                       */
/* ------------------------------------------------------------------ */

export interface SdBillingRate {
  id?: string
  ticketType: SdTicketType | null
  priorityId: string | null
  window: SdRateWindow
  hourlyRate: DecimalLike
  multiplier: DecimalLike
  position: number
}

export interface SdBillingFacts {
  ticketType: SdTicketType
  priorityId: string | null
  window: SdRateWindow
}

/**
 * Primeira regra (ordem de `position`, empate pela ordem recebida) cujo
 * tipo, prioridade e janela casam. `ticketType`/`priorityId` nulos na regra
 * são curinga.
 */
export function pickSdContractRate<T extends SdBillingRate>(
  rates: T[],
  facts: SdBillingFacts,
): T | null {
  const matches = rates
    .filter(
      (rate) =>
        rate.window === facts.window &&
        (rate.ticketType === null || rate.ticketType === facts.ticketType) &&
        (rate.priorityId === null || rate.priorityId === facts.priorityId),
    )
    .sort((a, b) => a.position - b.position)
  return matches[0] ?? null
}

export interface SdResolvedRate {
  rateId: string | null
  /** Valor da hora dentro da franquia (informativo). */
  hourlyRate: Prisma.Decimal
  /** Valor da hora cobrada (excedente). */
  overtimeRate: Prisma.Decimal
  multiplier: Prisma.Decimal
}

/**
 * Valor da hora de um apontamento. Uma regra específica vence o contrato,
 * inclusive no excedente (ela já é a tabela negociada daquela janela); sem
 * regra, a hora cobrada é `overtimeRate ?? hourlyRate` do contrato.
 */
export function resolveSdEntryRate(
  contract: Pick<SdBillingContract, 'hourlyRate' | 'overtimeRate'>,
  rates: SdBillingRate[],
  facts: SdBillingFacts,
): SdResolvedRate {
  const rate = pickSdContractRate(rates, facts)
  if (rate) {
    const hourly = dec(rate.hourlyRate)
    return {
      rateId: rate.id ?? null,
      hourlyRate: hourly,
      overtimeRate: hourly,
      multiplier: dec(rate.multiplier),
    }
  }
  const hourly = dec(contract.hourlyRate)
  return {
    rateId: null,
    hourlyRate: hourly,
    overtimeRate:
      contract.overtimeRate === null ? hourly : dec(contract.overtimeRate),
    multiplier: new Prisma.Decimal(1),
  }
}

/** Valor do apontamento inteiro: minutos × hora × multiplicador. */
export function sdEntryAmount(
  minutes: number,
  rate: Pick<SdResolvedRate, 'hourlyRate' | 'multiplier'>,
): Prisma.Decimal {
  if (minutes <= 0) return new Prisma.Decimal(0)
  return money(rate.hourlyRate.mul(rate.multiplier).mul(minutes).div(60))
}

/* ------------------------------------------------------------------ */
/* Período                                                              */
/* ------------------------------------------------------------------ */

export interface SdPeriodEntry {
  minutes: number
  billable: boolean
  overtimeRate: DecimalLike
  multiplier: DecimalLike
}

export interface SdPeriodTotals {
  /** Minutos apontados no período (faturáveis ou não). */
  usedMinutes: number
  /** Minutos marcados como faturáveis. */
  billableMinutes: number
  /** Minutos faturáveis cobertos pela franquia. */
  coveredMinutes: number
  /** Minutos faturáveis além da franquia. */
  overageMinutes: number
  /** Franquia que sobrou e acumula para o período seguinte. */
  carriedMinutes: number
  /** Valor a faturar (só o excedente). */
  amount: Prisma.Decimal
}

/**
 * Consolida o período: a franquia cobre os apontamentos faturáveis na ordem
 * recebida (cronológica) e o excedente é cobrado pela hora de excedente de
 * cada apontamento. `includedMinutes` já deve vir com o saldo acumulado.
 */
export function computeSdPeriodTotals(
  entries: SdPeriodEntry[],
  contract: Pick<SdBillingContract, 'carryOver'>,
  includedMinutes: number,
): SdPeriodTotals {
  let usedMinutes = 0
  let billableMinutes = 0
  let remaining = Math.max(includedMinutes, 0)
  let coveredMinutes = 0
  let overageMinutes = 0
  let amount = new Prisma.Decimal(0)

  for (const entry of entries) {
    const minutes = Math.max(entry.minutes, 0)
    usedMinutes += minutes
    if (!entry.billable) continue
    billableMinutes += minutes
    const covered = Math.min(minutes, remaining)
    remaining -= covered
    coveredMinutes += covered
    const charged = minutes - covered
    if (charged === 0) continue
    overageMinutes += charged
    amount = amount.add(
      dec(entry.overtimeRate).mul(dec(entry.multiplier)).mul(charged).div(60),
    )
  }

  return {
    usedMinutes,
    billableMinutes,
    coveredMinutes,
    overageMinutes,
    carriedMinutes: contract.carryOver ? remaining : 0,
    amount: money(amount),
  }
}

/* ------------------------------------------------------------------ */
/* Janelas do ciclo                                                     */
/* ------------------------------------------------------------------ */

/**
 * Período do ciclo que contém `at`, ancorado no calendário (UTC): mensal
 * começa no dia 1 do mês, trimestral no dia 1 de jan/abr/jul/out e anual no
 * dia 1 de janeiro. `end` é exclusivo (o início do período seguinte).
 */
export function sdPeriodRange(
  cycle: SdContractBillingCycle,
  at: Date,
): { start: Date; end: Date } {
  const year = at.getUTCFullYear()
  const month = at.getUTCMonth()
  if (cycle === 'YEARLY') {
    return {
      start: new Date(Date.UTC(year, 0, 1)),
      end: new Date(Date.UTC(year + 1, 0, 1)),
    }
  }
  if (cycle === 'QUARTERLY') {
    const first = Math.floor(month / 3) * 3
    return {
      start: new Date(Date.UTC(year, first, 1)),
      end: new Date(Date.UTC(year, first + 3, 1)),
    }
  }
  return {
    start: new Date(Date.UTC(year, month, 1)),
    end: new Date(Date.UTC(year, month + 1, 1)),
  }
}

/** Deslocamento do fuso (ms) no instante `ms`: local − UTC. */
function offsetAt(ms: number, timeZone: string): number {
  const p = localParts(new Date(ms), timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day) + p.minutes * MINUTE_MS
  return asUtc - Math.floor(ms / MINUTE_MS) * MINUTE_MS
}

/** Instante UTC da meia-noite local (fuso `timeZone`) do dia de `at`. */
export function sdLocalDayStart(at: Date, timeZone: string): Date {
  const p = localParts(at, timeZone)
  const dayUtc = Date.UTC(p.year, p.month - 1, p.day)
  const first = dayUtc - offsetAt(dayUtc, timeZone)
  return new Date(dayUtc - offsetAt(first, timeZone))
}

/**
 * Dia civil local de `at` (meia-noite a meia-noite, `end` exclusivo) — a
 * janela usada para saber se um apontamento é o primeiro do dia no chamado.
 * Imune a horário de verão: o dia seguinte é calculado do meio-dia.
 */
export function sdLocalDayRange(
  at: Date,
  cal: SdCalendar = SD_CALENDAR_24X7,
): { start: Date; end: Date } {
  const start = sdLocalDayStart(at, cal.timezone)
  const nextNoon = new Date(start.getTime() + 36 * 60 * MINUTE_MS)
  return { start, end: sdLocalDayStart(nextNoon, cal.timezone) }
}

/**
 * `true` se o contrato está **ativo** e vigente em `at`. Com `type`, também
 * confere se o contrato cobre aquele tipo de chamado (lista vazia = todos).
 */
export function sdContractCovers(
  contract: {
    status: string
    startsAt: Date
    endsAt: Date | null
    ticketTypes: SdTicketType[]
  },
  at: Date,
  type?: SdTicketType,
): boolean {
  if (contract.status !== 'ACTIVE') return false
  if (contract.startsAt.getTime() > at.getTime()) return false
  if (contract.endsAt && contract.endsAt.getTime() <= at.getTime()) return false
  if (!type) return true
  return (
    contract.ticketTypes.length === 0 || contract.ticketTypes.includes(type)
  )
}
