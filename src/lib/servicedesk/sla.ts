/**
 * Relógio de SLA do ServiceDesk em **minutos úteis** sobre um calendário de
 * expediente (`SdBusinessCalendar`): fuso IANA, janelas por dia da semana,
 * feriados e modo 24×7. Lib pura (só `Intl`), sem acesso a banco.
 *
 * Regras:
 * - Janelas `["HH:MM","HH:MM"]` são horário local do fuso do calendário.
 *   `"24:00"` = fim do dia. Fim menor que o início cruza a meia-noite
 *   (`["22:00","02:00"]` vai até as 02:00 do dia seguinte) e pertence ao dia
 *   em que começa (feriado do dia de início anula a janela inteira).
 * - Janelas sobrepostas não contam em dobro.
 * - `is24x7` ignora expediente e feriados (relógio corrido).
 * - Calendário sem nenhuma janela (ou só feriados por anos) cai no relógio
 *   corrido — nunca trava.
 */

export const SD_WEEKDAYS = [
  'sun',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
] as const
export type SdWeekday = (typeof SD_WEEKDAYS)[number]

export type SdTimeRange = [string, string]

export interface SdCalendar {
  timezone: string
  schedule: Partial<Record<SdWeekday, SdTimeRange[]>>
  holidays: { date: string; name?: string }[]
  is24x7: boolean
}

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS
/** Limite de dias varridos antes de desistir e usar o relógio corrido. */
const MAX_SCAN_DAYS = 366 * 5

/** Relógio corrido (sem expediente) — fallback e calendário ausente. */
export const SD_CALENDAR_24X7: SdCalendar = {
  timezone: 'UTC',
  schedule: {},
  holidays: [],
  is24x7: true,
}

const TIME = /^([01]\d|2[0-4]):([0-5]\d)$/

function parseTime(value: string): number | null {
  const match = TIME.exec(value)
  if (!match) return null
  const minutes = Number(match[1]) * 60 + Number(match[2])
  return minutes > 24 * 60 ? null : minutes
}

/**
 * Normaliza o JSON salvo em `SdBusinessCalendar` (schedule/holidays são
 * `Json`). Entradas malformadas são descartadas. `null` → 24×7.
 */
export function parseSdCalendar(
  row: {
    timezone?: string | null
    schedule?: unknown
    holidays?: unknown
    is24x7?: boolean | null
  } | null,
): SdCalendar {
  if (!row) return SD_CALENDAR_24X7
  const schedule: SdCalendar['schedule'] = {}
  const rawSchedule =
    row.schedule && typeof row.schedule === 'object'
      ? (row.schedule as Record<string, unknown>)
      : {}
  for (const day of SD_WEEKDAYS) {
    const ranges = rawSchedule[day]
    if (!Array.isArray(ranges)) continue
    schedule[day] = ranges.filter(
      (range): range is SdTimeRange =>
        Array.isArray(range) &&
        range.length === 2 &&
        typeof range[0] === 'string' &&
        typeof range[1] === 'string' &&
        parseTime(range[0]) !== null &&
        parseTime(range[1]) !== null,
    )
  }
  const holidays = Array.isArray(row.holidays)
    ? row.holidays.filter(
        (h): h is { date: string; name?: string } =>
          !!h &&
          typeof h === 'object' &&
          typeof (h as { date?: unknown }).date === 'string',
      )
    : []
  return {
    timezone: isValidTimeZone(row.timezone) ? row.timezone : 'UTC',
    schedule,
    holidays,
    is24x7: row.is24x7 === true,
  }
}

function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

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

/**
 * Instante UTC de uma hora local (`dayUtc` = meia-noite UTC do dia civil
 * local, `minutes` desde a meia-noite local, pode passar de 1440).
 */
function localToUtc(dayUtc: number, minutes: number, timeZone: string): number {
  const guess = dayUtc + minutes * MINUTE_MS
  const first = guess - offsetAt(guess, timeZone)
  const second = guess - offsetAt(first, timeZone)
  return second
}

/** Meia-noite UTC do dia civil local em que `ms` cai. */
function localDay(ms: number, timeZone: string): number {
  const p = localParts(ms, timeZone)
  return Date.UTC(p.year, p.month - 1, p.day)
}

/** Instante da meia-noite local (no fuso `timeZone`) do dia de `at`. */
export function startOfSdLocalDay(at: Date, timeZone: string): Date {
  return new Date(localToUtc(localDay(at.getTime(), timeZone), 0, timeZone))
}

function isoDate(dayUtc: number): string {
  return new Date(dayUtc).toISOString().slice(0, 10)
}

/* ------------------------------------------------------------------ */
/* Janelas de expediente                                                */
/* ------------------------------------------------------------------ */

function hasAnyWindow(cal: SdCalendar): boolean {
  return SD_WEEKDAYS.some((day) => (cal.schedule[day]?.length ?? 0) > 0)
}

function isWallClock(cal: SdCalendar): boolean {
  return cal.is24x7 || !hasAnyWindow(cal)
}

/** Janelas (UTC, ordenadas pelo início) que começam no dia local `dayUtc`. */
function windowsOfDay(
  dayUtc: number,
  cal: SdCalendar,
  holidays: Set<string>,
): [number, number][] {
  if (holidays.has(isoDate(dayUtc))) return []
  const weekday = SD_WEEKDAYS[new Date(dayUtc).getUTCDay()]
  const windows: [number, number][] = []
  for (const [from, to] of cal.schedule[weekday] ?? []) {
    const start = parseTime(from) as number
    let end = parseTime(to) as number
    if (end === start) continue
    if (end < start) end += 24 * 60
    windows.push([
      localToUtc(dayUtc, start, cal.timezone),
      localToUtc(dayUtc, end, cal.timezone),
    ])
  }
  return windows.sort((a, b) => a[0] - b[0])
}

/**
 * Percorre as janelas a partir de `fromMs` (inclusive a janela que cruzou a
 * meia-noite do dia anterior) chamando `visit(start, end)` com os trechos
 * não sobrepostos. `visit` devolve `true` para parar. Devolve `false` se
 * estourou `MAX_SCAN_DAYS` sem parar.
 */
function walkWindows(
  fromMs: number,
  cal: SdCalendar,
  visit: (start: number, end: number) => boolean,
): boolean {
  const holidays = new Set(cal.holidays.map((h) => h.date))
  let cursor = fromMs
  let day = localDay(fromMs, cal.timezone) - DAY_MS
  for (let i = 0; i < MAX_SCAN_DAYS; i++, day += DAY_MS) {
    for (const [start, end] of windowsOfDay(day, cal, holidays)) {
      if (end <= cursor) continue
      const from = Math.max(start, cursor)
      if (visit(from, end)) return true
      cursor = end
    }
  }
  return false
}

/** Instante após consumir `minutes` minutos úteis a partir de `start`. */
export function addBusinessMinutes(
  start: Date,
  minutes: number,
  cal: SdCalendar,
): Date {
  const startMs = start.getTime()
  if (minutes <= 0) return new Date(startMs)
  if (isWallClock(cal)) return new Date(startMs + minutes * MINUTE_MS)

  let remaining = minutes * MINUTE_MS
  let result = startMs + remaining
  const found = walkWindows(startMs, cal, (from, end) => {
    const available = end - from
    if (remaining <= available) {
      result = from + remaining
      return true
    }
    remaining -= available
    return false
  })
  return new Date(found ? result : startMs + minutes * MINUTE_MS)
}

/** Minutos úteis (inteiros, truncados) entre `a` e `b`; 0 se `b <= a`. */
export function businessMinutesBetween(
  a: Date,
  b: Date,
  cal: SdCalendar,
): number {
  const from = a.getTime()
  const to = b.getTime()
  if (to <= from) return 0
  if (isWallClock(cal)) return Math.floor((to - from) / MINUTE_MS)

  let total = 0
  walkWindows(from, cal, (start, end) => {
    if (start >= to) return true
    total += Math.min(end, to) - start
    return end >= to
  })
  return Math.floor(total / MINUTE_MS)
}

/* ------------------------------------------------------------------ */
/* Estado do SLA de um chamado                                          */
/* ------------------------------------------------------------------ */

export type SdSlaTimerState =
  | 'ok'
  | 'at_risk'
  | 'breached'
  | 'met'
  | 'paused'
  | 'none'

export interface SdSlaTimer {
  dueAt: string | null
  /** Minutos úteis restantes (negativo = atraso). `null` sem prazo/concluído. */
  remainingMinutes: number | null
  /** % do prazo consumido (0–∞, arredondado). `null` sem prazo. */
  percentUsed: number | null
  state: SdSlaTimerState
}

export interface SdSlaState {
  firstResponse: SdSlaTimer
  resolution: SdSlaTimer
}

export interface SdSlaTicketInput {
  createdAt: Date
  firstResponseDueAt: Date | null
  resolutionDueAt: Date | null
  firstRespondedAt: Date | null
  resolvedAt: Date | null
  slaPausedAt: Date | null
  slaPausedMinutes: number
  firstResponseBreached: boolean
  resolutionBreached: boolean
}

export interface SdSlaOptions {
  /** % do prazo a partir do qual o timer vira `at_risk` (padrão 80). */
  atRiskPercent?: number
  /** Calendário da política (ausente = relógio corrido). */
  calendar?: SdCalendar | null
}

function timer(
  input: SdSlaTicketInput,
  dueAt: Date | null,
  doneAt: Date | null,
  breachedFlag: boolean,
  now: Date,
  atRiskPercent: number,
  cal: SdCalendar,
): SdSlaTimer {
  if (!dueAt) {
    return {
      dueAt: null,
      remainingMinutes: null,
      percentUsed: null,
      state: 'none',
    }
  }
  const due = dueAt.toISOString()
  const target = Math.max(
    businessMinutesBetween(input.createdAt, dueAt, cal) -
      input.slaPausedMinutes,
    1,
  )

  if (doneAt) {
    const late = doneAt.getTime() > dueAt.getTime()
    const used =
      businessMinutesBetween(input.createdAt, doneAt, cal) -
      input.slaPausedMinutes
    return {
      dueAt: due,
      remainingMinutes: null,
      percentUsed: Math.max(0, Math.round((used / target) * 100)),
      state: late || breachedFlag ? 'breached' : 'met',
    }
  }

  const reference = input.slaPausedAt ?? now
  const remaining =
    reference.getTime() <= dueAt.getTime()
      ? businessMinutesBetween(reference, dueAt, cal)
      : -businessMinutesBetween(dueAt, reference, cal)
  const percentUsed = Math.max(
    0,
    Math.round(((target - remaining) / target) * 100),
  )
  const overdue = reference.getTime() > dueAt.getTime()

  let state: SdSlaTimerState
  if (breachedFlag || overdue) state = 'breached'
  else if (input.slaPausedAt) state = 'paused'
  else if (percentUsed >= atRiskPercent) state = 'at_risk'
  else state = 'ok'

  return { dueAt: due, remainingMinutes: remaining, percentUsed, state }
}

/**
 * Estado dos dois timers (1ª resposta e resolução) no instante `now`.
 * Pausado (`slaPausedAt`) congela o restante no momento da pausa. Prazo
 * vencido ou flag de violação gravada pelo worker → `breached` (também
 * depois de concluído, se concluiu atrasado).
 */
export function computeSlaState(
  ticket: SdSlaTicketInput,
  now: Date,
  options: SdSlaOptions = {},
): SdSlaState {
  const atRisk = options.atRiskPercent ?? 80
  const cal = options.calendar ?? SD_CALENDAR_24X7
  return {
    firstResponse: timer(
      ticket,
      ticket.firstResponseDueAt,
      ticket.firstRespondedAt,
      ticket.firstResponseBreached,
      now,
      atRisk,
      cal,
    ),
    resolution: timer(
      ticket,
      ticket.resolutionDueAt,
      ticket.resolvedAt,
      ticket.resolutionBreached,
      now,
      atRisk,
      cal,
    ),
  }
}
