import {
  SD_CHANGE_RECURRENCE_MAX_COUNT,
  type SdChangeRecurrenceInput,
} from '@/src/schemas/sd-change-window.schema'

/**
 * Expansão das janelas do calendário de mudanças — **lib pura**, sem banco e
 * sem estado: recebe a janela (início, fim e a recorrência salva em JSON) e
 * devolve as ocorrências que tocam um intervalo.
 *
 * A recorrência é uma RRULE simplificada: `DAILY`/`WEEKLY`/`MONTHLY` com
 * `interval`, `byDay` (só semanal) e um limite opcional (`until` ou `count`).
 * Cada ocorrência mantém a **duração** da janela original; o passo anda sobre
 * o `startsAt` em dias, semanas ou meses (mês curto gruda no último dia).
 *
 * Convenção de intervalo: `[from, to)` — uma ocorrência entra quando
 * `startsAt < to` e `endsAt > from`. Janelas que só encostam pela borda (o fim
 * de uma é o início da outra) **não** se sobrepõem.
 *
 * Séries abertas (sem `count` nem `until`) são cortadas pelo fim do intervalo
 * consultado, e a expansão pula direto para perto dele — uma janela semanal
 * criada anos atrás não custa mais que uma criada ontem. O resultado é sempre
 * finito: no máximo `SD_CHANGE_RECURRENCE_MAX_COUNT` ocorrências por janela.
 */

const DAY_MS = 24 * 60 * 60 * 1000

const WEEK_DAY_INDEX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
}

export interface SdDateRange {
  from: Date
  to: Date
}

export interface SdChangeWindowSource {
  id: string
  startsAt: Date
  endsAt: Date
  recurrence?: SdChangeRecurrenceInput | null
}

export interface SdChangeOccurrence {
  windowId: string
  startsAt: Date
  endsAt: Date
  /** `false` só na primeira ocorrência (a janela como foi cadastrada). */
  recurring: boolean
}

/** Dois períodos `[aStart, aEnd)` e `[bStart, bEnd)` se cruzam. */
export function sdPeriodsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime()
}

/** O período `[start, end)` cabe inteiro dentro de `[outerStart, outerEnd)`. */
export function sdPeriodContains(
  outerStart: Date,
  outerEnd: Date,
  start: Date,
  end: Date,
): boolean {
  return (
    outerStart.getTime() <= start.getTime() &&
    outerEnd.getTime() >= end.getTime()
  )
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

/** Avança `months` meses em UTC, grudando no último dia do mês mais curto. */
function addMonths(date: Date, months: number): Date {
  const day = date.getUTCDate()
  const shifted = new Date(date.getTime())
  shifted.setUTCDate(1)
  shifted.setUTCMonth(shifted.getUTCMonth() + months)
  const lastDay = new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0),
  ).getUTCDate()
  shifted.setUTCDate(Math.min(day, lastDay))
  return shifted
}

function monthsBetween(from: Date, to: Date): number {
  return (
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth())
  )
}

/** Fim da série: `until` (dia inteiro, inclusive) ou `null`. */
function untilLimit(recurrence: SdChangeRecurrenceInput): Date | null {
  if (!recurrence.until) return null
  const parsed = Date.parse(`${recurrence.until}T23:59:59.999Z`)
  return Number.isNaN(parsed) ? null : new Date(parsed)
}

/**
 * Inícios da repetição semanal nos dias de `byDay`, na semana deslocada de
 * `offsetDays` a partir do domingo da semana de `base`.
 */
function weeklyStarts(
  base: Date,
  offsetDays: number,
  byDay: readonly string[],
): Date[] {
  const sundayDiff = base.getUTCDay()
  return byDay
    .map((day) => WEEK_DAY_INDEX[day])
    .filter((index) => index !== undefined)
    .sort((a, b) => a - b)
    .map((index) => addDays(base, offsetDays + index - sundayDiff))
}

/** Inícios de uma "rodada" da série (uma rodada = um `interval`). */
function roundStarts(
  base: Date,
  recurrence: SdChangeRecurrenceInput,
  step: number,
  useByDay: boolean,
): Date[] {
  if (useByDay) {
    return weeklyStarts(base, step * recurrence.interval * 7, recurrence.byDay)
  }
  if (recurrence.freq === 'MONTHLY') {
    return [addMonths(base, step * recurrence.interval)]
  }
  const days =
    step * recurrence.interval * (recurrence.freq === 'WEEKLY' ? 7 : 1)
  return [addDays(base, days)]
}

/**
 * Primeira rodada que pode tocar `from` — uma a menos, por segurança, para
 * não perder a ocorrência que começa antes e termina depois de `from`.
 */
function firstStepFor(
  base: Date,
  recurrence: SdChangeRecurrenceInput,
  from: Date,
): number {
  if (from.getTime() <= base.getTime()) return 0
  const rounds =
    recurrence.freq === 'MONTHLY'
      ? monthsBetween(base, from) / recurrence.interval
      : (from.getTime() - base.getTime()) /
        (recurrence.interval * (recurrence.freq === 'WEEKLY' ? 7 : 1) * DAY_MS)
  return Math.max(0, Math.floor(rounds) - 1)
}

/**
 * Ocorrências da janela que tocam `[range.from, range.to)`, em ordem de
 * início. Sem recorrência devolve no máximo a própria janela.
 */
export function expandSdChangeWindow(
  window: SdChangeWindowSource,
  range: SdDateRange,
): SdChangeOccurrence[] {
  const baseMs = window.startsAt.getTime()
  const durationMs = Math.max(0, window.endsAt.getTime() - baseMs)

  const take = (start: Date): SdChangeOccurrence => ({
    windowId: window.id,
    startsAt: start,
    endsAt: new Date(start.getTime() + durationMs),
    recurring: start.getTime() !== baseMs,
  })
  const inRange = (o: SdChangeOccurrence): boolean =>
    sdPeriodsOverlap(o.startsAt, o.endsAt, range.from, range.to)

  const recurrence = window.recurrence ?? null
  if (!recurrence) {
    const single = take(window.startsAt)
    return inRange(single) ? [single] : []
  }

  const limit = untilLimit(recurrence)
  const useByDay = recurrence.freq === 'WEEKLY' && recurrence.byDay.length > 0
  const perRound = useByDay ? recurrence.byDay.length : 1
  // Dias de `byDay` anteriores ao início não entram na série nem consomem
  // `count` — só existem porque a rodada começa no domingo.
  const skipped = useByDay
    ? weeklyStarts(window.startsAt, 0, recurrence.byDay).filter(
        (start) => start.getTime() < baseMs,
      ).length
    : 0
  const maxOrdinal = recurrence.count ?? Number.POSITIVE_INFINITY

  const firstStep = firstStepFor(window.startsAt, recurrence, range.from)
  const lastStep = firstStep + SD_CHANGE_RECURRENCE_MAX_COUNT
  const out: SdChangeOccurrence[] = []

  for (let step = firstStep; step < lastStep; step++) {
    const starts = roundStarts(window.startsAt, recurrence, step, useByDay)
    let done = false
    for (let i = 0; i < starts.length; i++) {
      const start = starts[i]
      if (start.getTime() < baseMs) continue
      if (step * perRound + i - skipped >= maxOrdinal) {
        done = true
        break
      }
      if (limit && start.getTime() > limit.getTime()) {
        done = true
        break
      }
      if (start.getTime() >= range.to.getTime()) {
        done = true
        break
      }
      const occurrence = take(start)
      if (inRange(occurrence)) out.push(occurrence)
      if (out.length >= SD_CHANGE_RECURRENCE_MAX_COUNT) {
        done = true
        break
      }
    }
    if (done) break
  }

  return out
}

/** Expande várias janelas e devolve tudo ordenado por início. */
export function expandSdChangeWindows(
  windows: readonly SdChangeWindowSource[],
  range: SdDateRange,
): SdChangeOccurrence[] {
  return windows
    .flatMap((window) => expandSdChangeWindow(window, range))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
}

/**
 * `true` quando a janela se aplica ao item de configuração e ao departamento
 * do chamado. Lista vazia = "todos" (a janela vale para a workspace inteira).
 */
export function sdWindowApplies(
  scope: { configItemIds: readonly string[]; departmentIds: readonly string[] },
  target: { configItemId: string | null; departmentId: string | null },
): boolean {
  const byItem =
    scope.configItemIds.length === 0 ||
    (!!target.configItemId && scope.configItemIds.includes(target.configItemId))
  const byDepartment =
    scope.departmentIds.length === 0 ||
    (!!target.departmentId && scope.departmentIds.includes(target.departmentId))
  return byItem && byDepartment
}

/**
 * Ocorrências que cruzam o período planejado — a base do aviso de
 * congelamento: congelar metade da mudança já é motivo de aviso.
 */
export function sdOccurrencesCovering(
  occurrences: readonly SdChangeOccurrence[],
  period: { startsAt: Date; endsAt: Date },
): SdChangeOccurrence[] {
  return occurrences.filter((o) =>
    sdPeriodsOverlap(o.startsAt, o.endsAt, period.startsAt, period.endsAt),
  )
}

/**
 * Intervalo que cobre o mês de `date` com as semanas completas (domingo a
 * sábado) — o que o calendário mensal mostra.
 */
export function sdMonthGridRange(date: Date): SdDateRange {
  const firstOfMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
  )
  const from = addDays(firstOfMonth, -firstOfMonth.getUTCDay())
  const firstOfNext = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1),
  )
  const to = addDays(firstOfNext, (7 - firstOfNext.getUTCDay()) % 7)
  return { from, to }
}

/** Intervalo da semana (domingo a sábado) que contém `date`. */
export function sdWeekRange(date: Date): SdDateRange {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
  const from = addDays(start, -start.getUTCDay())
  return { from, to: addDays(from, 7) }
}
