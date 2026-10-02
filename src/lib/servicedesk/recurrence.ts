/**
 * Agenda dos chamados recorrentes do ServiceDesk (manutenção preventiva):
 * dada uma regra, qual é a **próxima ocorrência** e as N seguintes. Lib
 * pura (só `Intl`), sem banco e **sem depender do fuso do servidor** — todo
 * cálculo de dia e hora acontece no fuso da regra.
 *
 * Regras adotadas (o que a tela e o worker podem prometer):
 * - `atTime` é horário local do fuso da regra (`HH:MM`, 00:00–23:59).
 * - `interval` conta a partir de `startsAt` (dia, semana, mês ou ano dele):
 *   DAILY a cada N dias; WEEKLY a cada N semanas (semana começa no
 *   domingo); MONTHLY a cada N meses; YEARLY a cada N anos.
 * - `byWeekday` (0=domingo) filtra DAILY e escolhe os dias do WEEKLY; vazio
 *   no WEEKLY = o dia da semana de `startsAt`. É ignorado em MONTHLY/YEARLY.
 * - `byMonthday` vale para MONTHLY/YEARLY; vazio = o dia de `startsAt`.
 *   **Dia que não existe no mês cai no último dia do mês** (31 → 30/04,
 *   28/02 ou 29/02; YEARLY em 29/02 → 28/02 nos anos comuns).
 * - Vigência: nenhuma ocorrência antes de `startsAt` nem depois de `endsAt`.
 * - `leadTimeMinutes` não muda a ocorrência: só antecipa a abertura
 *   (`runAt = scheduledFor − antecedência`).
 * - Horário local inexistente (adiantamento do relógio, ex.: 00:30 de
 *   15/10/2017 em São Paulo): a ocorrência cai no primeiro instante válido
 *   depois do salto. Horário ambíguo (atraso do relógio): vale a primeira
 *   passagem.
 */

export const SD_RECURRENCE_FREQUENCIES = [
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'YEARLY',
] as const
export type SdRecurrenceFrequency = (typeof SD_RECURRENCE_FREQUENCIES)[number]

/** Rótulos pt-BR dos dias da semana (0 = domingo). */
export const SD_WEEKDAY_LABELS = [
  'domingo',
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
] as const

/** A agenda de uma regra, do jeito que está em `SdRecurringTicket`. */
export interface SdRecurrenceSchedule {
  frequency: SdRecurrenceFrequency
  interval: number
  /** 0 = domingo … 6 = sábado. */
  byWeekday: number[]
  byMonthday: number | null
  /** `HH:MM` local. */
  atTime: string
  /** Fuso IANA. */
  timezone: string
  startsAt: Date
  endsAt: Date | null
  leadTimeMinutes: number
}

/** Uma ocorrência: quando ela é e quando o worker deve abrir o chamado. */
export interface SdOccurrence {
  /** Momento agendado da rotina (chave de idempotência da ocorrência). */
  scheduledFor: Date
  /** `scheduledFor` menos a antecedência — é o `nextRunAt` da regra. */
  runAt: Date
}

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS

/** Tetos de varredura: agenda que não casa em nada devolve `null`. */
const MAX_DAYS = 4000
const MAX_MONTHS = 400
const MAX_YEARS = 50

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/

/* ------------------------------------------------------------------ */
/* Fuso horário (Intl)                                                  */
/* ------------------------------------------------------------------ */

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
      second: '2-digit',
    })
    formatters.set(timeZone, fmt)
  }
  return fmt
}

export function isValidSdTimeZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

interface LocalParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function localParts(ms: number, timeZone: string): LocalParts {
  const parts: Record<string, number> = {}
  for (const part of formatterFor(timeZone).formatToParts(new Date(ms))) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value)
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  }
}

/** Deslocamento do fuso (ms) no instante `ms`: local − UTC. */
function offsetAt(ms: number, timeZone: string): number {
  const p = localParts(ms, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(ms / 1000) * 1000
}

function isLocal(
  ms: number,
  dayUtc: number,
  minutes: number,
  timeZone: string,
): boolean {
  const p = localParts(ms, timeZone)
  return (
    Date.UTC(p.year, p.month - 1, p.day) === dayUtc &&
    p.hour * 60 + p.minute === minutes
  )
}

/**
 * Instante UTC de uma hora local. `dayUtc` é a meia-noite UTC do dia civil
 * local; `minutes` conta da meia-noite local. Hora ambígua (o relógio
 * atrasou) resolve na primeira passagem; hora inexistente (o relógio
 * adiantou) cai no primeiro instante depois do salto.
 */
function localToUtc(dayUtc: number, minutes: number, timeZone: string): number {
  const guess = dayUtc + minutes * MINUTE_MS
  const first = guess - offsetAt(guess, timeZone)
  if (isLocal(first, dayUtc, minutes, timeZone)) return first
  const second = guess - offsetAt(first, timeZone)
  return isLocal(second, dayUtc, minutes, timeZone) ? second : first
}

/** Meia-noite UTC do dia civil local em que `ms` cai. */
function localDay(ms: number, timeZone: string): number {
  const p = localParts(ms, timeZone)
  return Date.UTC(p.year, p.month - 1, p.day)
}

function parseAtTime(value: string): number | null {
  const match = TIME.exec(value.trim())
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

/** Dias do mês (`month` 1–12). */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/* ------------------------------------------------------------------ */
/* Validação                                                            */
/* ------------------------------------------------------------------ */

/**
 * Problema da agenda em pt-BR, ou `null` quando ela é válida. O service
 * transforma a mensagem em `SD_RECURRING_SCHEDULE_INVALID`.
 */
export function sdRecurrenceProblem(
  schedule: SdRecurrenceSchedule,
): string | null {
  if (!SD_RECURRENCE_FREQUENCIES.includes(schedule.frequency)) {
    return 'Frequência inválida'
  }
  if (!Number.isInteger(schedule.interval) || schedule.interval < 1) {
    return 'O intervalo deve ser de pelo menos 1'
  }
  if (parseAtTime(schedule.atTime) === null) {
    return 'Horário inválido (use HH:MM)'
  }
  if (!isValidSdTimeZone(schedule.timezone)) {
    return `Fuso horário desconhecido: ${schedule.timezone}`
  }
  if (
    schedule.byWeekday.some(
      (day) => !Number.isInteger(day) || day < 0 || day > 6,
    )
  ) {
    return 'Dia da semana inválido (0 = domingo … 6 = sábado)'
  }
  if (new Set(schedule.byWeekday).size !== schedule.byWeekday.length) {
    return 'Dia da semana repetido'
  }
  if (
    schedule.byMonthday !== null &&
    schedule.byMonthday !== undefined &&
    (!Number.isInteger(schedule.byMonthday) ||
      schedule.byMonthday < 1 ||
      schedule.byMonthday > 31)
  ) {
    return 'Dia do mês inválido (1 a 31)'
  }
  if (Number.isNaN(schedule.startsAt.getTime())) {
    return 'Início da vigência inválido'
  }
  if (schedule.endsAt && Number.isNaN(schedule.endsAt.getTime())) {
    return 'Fim da vigência inválido'
  }
  if (
    schedule.endsAt &&
    schedule.endsAt.getTime() <= schedule.startsAt.getTime()
  ) {
    return 'O fim da vigência deve ser depois do início'
  }
  if (
    !Number.isInteger(schedule.leadTimeMinutes) ||
    schedule.leadTimeMinutes < 0
  ) {
    return 'A antecedência deve ser de 0 minuto ou mais'
  }
  if (nextSdOccurrence(schedule, new Date(schedule.startsAt.getTime() - 1))) {
    return null
  }
  return 'Esta agenda não gera nenhuma ocorrência dentro da vigência'
}

/* ------------------------------------------------------------------ */
/* Enumeração das ocorrências                                           */
/* ------------------------------------------------------------------ */

/**
 * Gerador dos dias candidatos. A varredura nunca começa antes do dia de
 * `startsAt`, então os enumeradores só precisam checar o padrão.
 */
interface Enumerator {
  /** Dias civis locais (meia-noite UTC) candidatos, em ordem. */
  days: (index: number) => number | null
  limit: number
}

function dailyEnumerator(
  schedule: SdRecurrenceSchedule,
  fromDay: number,
  startDay: number,
): Enumerator {
  const weekdays = new Set(schedule.byWeekday)
  return {
    limit: MAX_DAYS,
    days: (index) => {
      const day = fromDay + index * DAY_MS
      const elapsed = Math.round((day - startDay) / DAY_MS)
      if (elapsed % schedule.interval !== 0) return null
      if (weekdays.size > 0 && !weekdays.has(new Date(day).getUTCDay())) {
        return null
      }
      return day
    },
  }
}

function weeklyEnumerator(
  schedule: SdRecurrenceSchedule,
  fromDay: number,
  startDay: number,
): Enumerator {
  const weekdays =
    schedule.byWeekday.length > 0
      ? new Set(schedule.byWeekday)
      : new Set([new Date(startDay).getUTCDay()])
  /** Domingo da semana de `startsAt`. */
  const startWeek = startDay - new Date(startDay).getUTCDay() * DAY_MS
  return {
    limit: MAX_DAYS,
    days: (index) => {
      const day = fromDay + index * DAY_MS
      const week = day - new Date(day).getUTCDay() * DAY_MS
      const elapsed = Math.round((week - startWeek) / (7 * DAY_MS))
      if (elapsed % schedule.interval !== 0) return null
      return weekdays.has(new Date(day).getUTCDay()) ? day : null
    },
  }
}

function monthlyEnumerator(
  schedule: SdRecurrenceSchedule,
  fromDay: number,
  startDay: number,
): Enumerator {
  const start = new Date(startDay)
  const from = new Date(fromDay)
  const monthday = schedule.byMonthday ?? start.getUTCDate()
  const baseMonths = start.getUTCFullYear() * 12 + start.getUTCMonth()
  const fromMonths = from.getUTCFullYear() * 12 + from.getUTCMonth()
  return {
    limit: MAX_MONTHS,
    days: (index) => {
      const months = fromMonths + index
      if ((months - baseMonths) % schedule.interval !== 0) return null
      const year = Math.floor(months / 12)
      const month = (months % 12) + 1
      const day = Math.min(monthday, daysInMonth(year, month))
      return Date.UTC(year, month - 1, day)
    },
  }
}

function yearlyEnumerator(
  schedule: SdRecurrenceSchedule,
  fromDay: number,
  startDay: number,
): Enumerator {
  const start = new Date(startDay)
  const month = start.getUTCMonth() + 1
  const monthday = schedule.byMonthday ?? start.getUTCDate()
  const baseYear = start.getUTCFullYear()
  const fromYear = new Date(fromDay).getUTCFullYear()
  return {
    limit: MAX_YEARS,
    days: (index) => {
      const year = fromYear + index
      if ((year - baseYear) % schedule.interval !== 0) return null
      const day = Math.min(monthday, daysInMonth(year, month))
      return Date.UTC(year, month - 1, day)
    },
  }
}

function enumeratorFor(
  schedule: SdRecurrenceSchedule,
  fromDay: number,
  startDay: number,
): Enumerator {
  switch (schedule.frequency) {
    case 'DAILY':
      return dailyEnumerator(schedule, fromDay, startDay)
    case 'WEEKLY':
      return weeklyEnumerator(schedule, fromDay, startDay)
    case 'MONTHLY':
      return monthlyEnumerator(schedule, fromDay, startDay)
    default:
      return yearlyEnumerator(schedule, fromDay, startDay)
  }
}

function occurrenceOf(
  schedule: SdRecurrenceSchedule,
  dayUtc: number,
  minutes: number,
): SdOccurrence {
  const scheduledFor = localToUtc(dayUtc, minutes, schedule.timezone)
  return {
    scheduledFor: new Date(scheduledFor),
    runAt: new Date(scheduledFor - schedule.leadTimeMinutes * MINUTE_MS),
  }
}

/**
 * As próximas `limit` ocorrências com `scheduledFor` **estritamente depois**
 * de `after`, dentro da vigência. Devolve menos que `limit` (ou nada) quando
 * a agenda termina antes.
 */
export function nextSdOccurrences(
  schedule: SdRecurrenceSchedule,
  after: Date,
  limit: number,
): SdOccurrence[] {
  const minutes = parseAtTime(schedule.atTime)
  if (
    minutes === null ||
    limit <= 0 ||
    !isValidSdTimeZone(schedule.timezone) ||
    !Number.isInteger(schedule.interval) ||
    schedule.interval < 1 ||
    Number.isNaN(schedule.startsAt.getTime()) ||
    Number.isNaN(after.getTime())
  ) {
    return []
  }

  const { timezone, startsAt, endsAt } = schedule
  const floor = Math.max(after.getTime(), startsAt.getTime() - 1)
  const startDay = localDay(startsAt.getTime(), timezone)
  // Começa um dia antes: a ocorrência do dia anterior pode cair depois de
  // `floor` quando o fuso joga o horário local para o dia seguinte em UTC.
  const fromDay = Math.max(localDay(floor, timezone) - DAY_MS, startDay)
  const enumerator = enumeratorFor(schedule, fromDay, startDay)

  const found: SdOccurrence[] = []
  for (let index = 0; index < enumerator.limit; index++) {
    const day = enumerator.days(index)
    if (day === null) continue
    const occurrence = occurrenceOf(schedule, day, minutes)
    const at = occurrence.scheduledFor.getTime()
    if (at <= floor || at < startsAt.getTime()) continue
    if (endsAt && at > endsAt.getTime()) break
    found.push(occurrence)
    if (found.length === limit) break
  }
  return found
}

/** A próxima ocorrência depois de `after`, ou `null` se a agenda terminou. */
export function nextSdOccurrence(
  schedule: SdRecurrenceSchedule,
  after: Date,
): SdOccurrence | null {
  return nextSdOccurrences(schedule, after, 1)[0] ?? null
}

/**
 * Primeira ocorrência de uma regra criada ou editada agora: respeita a
 * vigência e **não faz backfill** — ocorrências anteriores a `now` ficam
 * para trás.
 */
export function firstSdOccurrence(
  schedule: SdRecurrenceSchedule,
  now: Date,
): SdOccurrence | null {
  const anchor = Math.max(now.getTime(), schedule.startsAt.getTime() - 1)
  return nextSdOccurrence(schedule, new Date(anchor))
}

/** Rótulo pt-BR da agenda, para a lista e a pré-visualização. */
export function describeSdRecurrence(schedule: SdRecurrenceSchedule): string {
  const every = schedule.interval > 1 ? `${schedule.interval} ` : ''
  const weekdays = schedule.byWeekday
    .slice()
    .sort((a, b) => a - b)
    .map((day) => SD_WEEKDAY_LABELS[day])
    .join(', ')

  switch (schedule.frequency) {
    case 'DAILY':
      return weekdays
        ? `A cada ${every}dia${schedule.interval > 1 ? 's' : ''}, somente ${weekdays}, às ${schedule.atTime}`
        : `A cada ${every}dia${schedule.interval > 1 ? 's' : ''}, às ${schedule.atTime}`
    case 'WEEKLY':
      return `A cada ${every}semana${schedule.interval > 1 ? 's' : ''}${
        weekdays ? ` (${weekdays})` : ''
      }, às ${schedule.atTime}`
    case 'MONTHLY':
      return `A cada ${every}${schedule.interval > 1 ? 'meses' : 'mês'}, no dia ${
        schedule.byMonthday ?? 'de início'
      }, às ${schedule.atTime}`
    default:
      return `A cada ${every}ano${schedule.interval > 1 ? 's' : ''}, às ${schedule.atTime}`
  }
}
