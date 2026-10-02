/**
 * Agenda e período do relatório agendado — lib **pura** (só `Intl`).
 *
 * Tudo acontece no **fuso do relatório**: "dia 1 às 07:00" é 07:00 em São
 * Paulo, não no servidor; o período `LAST_MONTH` é o mês civil do fuso do
 * relatório, não o mês UTC. Isso é o que faz o número do relatório casar com
 * o que o cliente vê no calendário dele (e é o bug que o CI em UTC revela
 * quando se formata data no fuso do navegador).
 */

export type SdReportPeriodKind =
  | 'LAST_MONTH'
  | 'LAST_WEEK'
  | 'CURRENT_MONTH'
  | 'LAST_30_DAYS'
  | 'LAST_90_DAYS'

export interface SdReportRange {
  /** Início inclusivo. */
  start: Date
  /** Fim **exclusivo**. */
  end: Date
}

export interface SdReportScheduleSpec {
  /** 1–28. */
  dayOfMonth: number
  /** `HH:MM` local. */
  atTime: string
  /** Fuso IANA. */
  timezone: string
}

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/

export function isValidSdReportTimeZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone)
  if (cached) return cached
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  formatters.set(timeZone, fmt)
  return fmt
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
    hour: parts.hour % 24,
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
 * local e `minutes` conta da meia-noite local. Hora ambígua resolve na
 * primeira passagem; hora inexistente cai no primeiro instante após o salto.
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

function startOfLocalDay(at: Date, timeZone: string): Date {
  return new Date(localToUtc(localDay(at.getTime(), timeZone), 0, timeZone))
}

function startOfLocalMonth(at: Date, timeZone: string, shift = 0): Date {
  const p = localParts(at.getTime(), timeZone)
  const month = p.month - 1 + shift
  const year = p.year + Math.floor(month / 12)
  const normalized = ((month % 12) + 12) % 12
  return new Date(localToUtc(Date.UTC(year, normalized, 1), 0, timeZone))
}

function parseAtTime(value: string): number | null {
  const match = TIME.exec(value.trim())
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

/**
 * Período apurado, no fuso do relatório. `LAST_MONTH` é o mês civil
 * anterior; `CURRENT_MONTH` vai do dia 1 até **agora**; os demais são
 * janelas de dias civis fechadas no início de hoje (o dia corrente, ainda em
 * andamento, não entra e por isso o número não muda ao reprocessar).
 */
export function sdReportPeriodRange(
  period: SdReportPeriodKind,
  now: Date,
  timezone: string,
): SdReportRange {
  const tz = isValidSdReportTimeZone(timezone) ? timezone : 'UTC'
  const today = startOfLocalDay(now, tz)

  switch (period) {
    case 'LAST_MONTH':
      return {
        start: startOfLocalMonth(now, tz, -1),
        end: startOfLocalMonth(now, tz),
      }
    case 'CURRENT_MONTH':
      return { start: startOfLocalMonth(now, tz), end: new Date(now) }
    case 'LAST_WEEK':
      return { start: shiftLocalDays(today, -7, tz), end: today }
    case 'LAST_30_DAYS':
      return { start: shiftLocalDays(today, -30, tz), end: today }
    default:
      return { start: shiftLocalDays(today, -90, tz), end: today }
  }
}

/** Meia-noite local `days` dias antes/depois de `from` (sobrevive ao DST). */
function shiftLocalDays(from: Date, days: number, timeZone: string): Date {
  const target = localDay(from.getTime() + days * DAY_MS, timeZone)
  return new Date(localToUtc(target, 0, timeZone))
}

/**
 * Problema da agenda em pt-BR, ou `null` quando ela é válida. O service
 * transforma a mensagem em `SD_REPORT_SCHEDULE_INVALID`.
 */
export function sdReportScheduleProblem(
  schedule: SdReportScheduleSpec,
): string | null {
  if (!isValidSdReportTimeZone(schedule.timezone)) {
    return `Fuso horário desconhecido: ${schedule.timezone}`
  }
  if (parseAtTime(schedule.atTime) === null) {
    return 'Horário inválido (use HH:MM)'
  }
  if (
    !Number.isInteger(schedule.dayOfMonth) ||
    schedule.dayOfMonth < 1 ||
    schedule.dayOfMonth > 28
  ) {
    return 'Dia do mês deve ficar entre 1 e 28'
  }
  return null
}

/**
 * Próximo envio **depois** de `from`: `dayOfMonth` às `atTime` no fuso do
 * relatório. `null` quando a agenda é inválida. Como `dayOfMonth` vai só até
 * 28, o dia existe em todo mês — nunca há salto de fevereiro.
 */
export function sdReportNextRunAt(
  schedule: SdReportScheduleSpec,
  from: Date,
): Date | null {
  if (sdReportScheduleProblem(schedule)) return null
  const tz = schedule.timezone
  const minutes = parseAtTime(schedule.atTime) as number
  const parts = localParts(from.getTime(), tz)

  const at = (shift: number): number => {
    const month = parts.month - 1 + shift
    const year = parts.year + Math.floor(month / 12)
    const normalized = ((month % 12) + 12) % 12
    return localToUtc(
      Date.UTC(year, normalized, schedule.dayOfMonth),
      minutes,
      tz,
    )
  }

  // O dia deste mês, se ainda está à frente; senão o do mês que vem — que é
  // sempre depois de `from`, então não há caso sem resposta.
  const thisMonth = at(0)
  return new Date(thisMonth > from.getTime() ? thisMonth : at(1))
}

/** `dd/MM/yyyy` no fuso do relatório (nunca no fuso de quem lê). */
export function formatSdReportDate(
  at: Date | string,
  timezone: string,
): string {
  const date = typeof at === 'string' ? new Date(at) : at
  const tz = isValidSdReportTimeZone(timezone) ? timezone : 'UTC'
  const p = localParts(date.getTime(), tz)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(p.day)}/${pad(p.month)}/${p.year}`
}

/** `dd/MM/yyyy HH:mm` no fuso do relatório. */
export function formatSdReportDateTime(
  at: Date | string,
  timezone: string,
): string {
  const date = typeof at === 'string' ? new Date(at) : at
  const tz = isValidSdReportTimeZone(timezone) ? timezone : 'UTC'
  const p = localParts(date.getTime(), tz)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${formatSdReportDate(date, tz)} ${pad(p.hour)}:${pad(p.minute)}`
}

/**
 * Rótulo do período apurado: `01/09/2026 a 30/09/2026` (o fim exclusivo é
 * mostrado como o último dia incluído, que é o que o leitor espera).
 */
export function formatSdReportRange(
  range: { start: Date | string; end: Date | string },
  timezone: string,
): string {
  const start =
    typeof range.start === 'string' ? new Date(range.start) : range.start
  const end = typeof range.end === 'string' ? new Date(range.end) : range.end
  const lastIncluded = new Date(
    Math.max(end.getTime() - MINUTE_MS, start.getTime()),
  )
  return `${formatSdReportDate(start, timezone)} a ${formatSdReportDate(lastIncluded, timezone)}`
}
