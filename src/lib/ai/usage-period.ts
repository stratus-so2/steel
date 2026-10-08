/**
 * Calendar math for the Steel AI usage pages (pure, no I/O). Everything is
 * in **UTC**, the same clock as the monthly quota (`currentPeriodStart`):
 * days, ISO weeks (Monday 00:00 UTC) and months. The UI labels it "UTC".
 */

export const DAY_MS = 24 * 60 * 60 * 1000

export const AI_USAGE_PERIOD_PRESETS = [
  'this_month',
  'last_month',
  'last_7_days',
  'last_30_days',
  'last_90_days',
  'custom',
] as const
export type AiUsagePeriodPreset = (typeof AI_USAGE_PERIOD_PRESETS)[number]

/** Longest custom range accepted (inclusive days). */
export const MAX_AI_USAGE_RANGE_DAYS = 366

export interface UtcRange {
  /** Inclusive, 00:00 UTC. */
  from: Date
  /** Exclusive, 00:00 UTC of the day after the last one. */
  to: Date
}

export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
}

export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

export function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

export function addUtcMonths(date: Date, months: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  )
}

/** ISO week start: Monday 00:00 UTC. */
export function startOfUtcWeek(date: Date): Date {
  const day = startOfUtcDay(date)
  const isoDow = (day.getUTCDay() + 6) % 7 // Monday = 0
  return addUtcDays(day, -isoDow)
}

/** `YYYY-MM-DD` of a UTC instant. */
export function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Parses `YYYY-MM-DD` as 00:00 UTC; `null` for an impossible date. */
export function parseUtcDay(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const [, y, m, d] = match.map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return utcDayKey(date) === value ? date : null
}

/** Whole days between two UTC midnights. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS)
}

/**
 * Resolves a period filter to a UTC day range. Custom ranges must already
 * be validated (`from <= to`, both present) by the Zod schema.
 */
export function resolveAiUsagePeriod(
  input: { period: AiUsagePeriodPreset; from?: string; to?: string },
  now: Date = new Date(),
): UtcRange {
  const tomorrow = addUtcDays(startOfUtcDay(now), 1)
  switch (input.period) {
    case 'last_month': {
      const thisMonth = startOfUtcMonth(now)
      return { from: addUtcMonths(thisMonth, -1), to: thisMonth }
    }
    case 'last_7_days':
      return { from: addUtcDays(tomorrow, -7), to: tomorrow }
    case 'last_30_days':
      return { from: addUtcDays(tomorrow, -30), to: tomorrow }
    case 'last_90_days':
      return { from: addUtcDays(tomorrow, -90), to: tomorrow }
    case 'custom': {
      const from = parseUtcDay(input.from ?? '') ?? startOfUtcMonth(now)
      const last = parseUtcDay(input.to ?? '') ?? startOfUtcDay(now)
      return { from, to: addUtcDays(last, 1) }
    }
    default:
      return { from: startOfUtcMonth(now), to: tomorrow }
  }
}
