import { startOfSdLocalDay } from '@/src/lib/servicedesk/sla'

/**
 * Calendar math of the work logs and the productivity panel (pure). Days
 * are civil days in the workspace's business-calendar time zone, never the
 * browser's or the server's.
 */

export const WORKLOG_PERIOD_PRESETS = [
  'last_7_days',
  'last_30_days',
  'this_month',
  'last_month',
  'custom',
] as const
export type WorklogPeriodPreset = (typeof WORKLOG_PERIOD_PRESETS)[number]

/** Longest custom range (inclusive days). */
export const MAX_WORKLOG_RANGE_DAYS = 92

export interface LocalRange {
  /** Inclusive: local midnight of the first day. */
  from: Date
  /** Exclusive: local midnight of the day after the last one. */
  to: Date
}

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

const dayKeyFormatters = new Map<string, Intl.DateTimeFormat>()

/** `YYYY-MM-DD` of the civil day `at` falls on, in `timeZone`. */
export function localDayKey(at: Date, timeZone: string): string {
  let formatter = dayKeyFormatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    dayKeyFormatters.set(timeZone, formatter)
  }
  return formatter.format(at)
}

/** Local midnight (as an instant) of the civil day `key` in `timeZone`. */
export function localDayStart(key: string, timeZone: string): Date {
  // Noon UTC is still the same civil day for any zone between -11 and +11.
  return startOfSdLocalDay(new Date(`${key}T12:00:00.000Z`), timeZone)
}

/** `key` shifted by `days` civil days. */
export function addDayKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS)
    .toISOString()
    .slice(0, 10)
}

/** Monday (`YYYY-MM-DD`) of the week `key` belongs to. */
export function weekStartKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return addDayKey(key, -((weekday + 6) % 7))
}

/** Inclusive day count between two keys. */
export function dayKeySpan(fromKey: string, toKey: string): number {
  const a = Date.parse(`${fromKey}T00:00:00.000Z`)
  const b = Date.parse(`${toKey}T00:00:00.000Z`)
  return Math.round((b - a) / DAY_MS) + 1
}

export interface WorklogPeriodInput {
  period: WorklogPeriodPreset
  /** `YYYY-MM-DD`, required with `custom`. */
  from?: string
  to?: string
}

/** First and last day (inclusive keys) of a preset, relative to `now`. */
export function resolveWorklogDays(
  input: WorklogPeriodInput,
  now: Date,
  timeZone: string,
): { fromKey: string; toKey: string } {
  const today = localDayKey(now, timeZone)
  switch (input.period) {
    case 'last_7_days':
      return { fromKey: addDayKey(today, -6), toKey: today }
    case 'this_month':
      return { fromKey: `${today.slice(0, 8)}01`, toKey: today }
    case 'last_month': {
      const firstOfThis = `${today.slice(0, 8)}01`
      const lastOfPrevious = addDayKey(firstOfThis, -1)
      return {
        fromKey: `${lastOfPrevious.slice(0, 8)}01`,
        toKey: lastOfPrevious,
      }
    }
    case 'custom':
      return {
        fromKey: input.from ?? today,
        toKey: input.to ?? input.from ?? today,
      }
    default:
      return { fromKey: addDayKey(today, -29), toKey: today }
  }
}

export function resolveWorklogRange(
  input: WorklogPeriodInput,
  now: Date,
  timeZone: string,
): LocalRange & { fromKey: string; toKey: string } {
  const { fromKey, toKey } = resolveWorklogDays(input, now, timeZone)
  return {
    fromKey,
    toKey,
    from: localDayStart(fromKey, timeZone),
    to: localDayStart(addDayKey(toKey, 1), timeZone),
  }
}

/** The range of the same length right before `range` (week-over-week etc.). */
export function previousRange(range: LocalRange): LocalRange {
  const length = range.to.getTime() - range.from.getTime()
  return { from: new Date(range.from.getTime() - length), to: range.from }
}

export function inRange(at: Date | null, range: LocalRange): boolean {
  if (!at) return false
  const ms = at.getTime()
  return ms >= range.from.getTime() && ms < range.to.getTime()
}
