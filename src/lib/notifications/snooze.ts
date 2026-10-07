import { Cron } from 'croner'

/**
 * Snooze presets of the inbox. Pure (no I/O): the service resolves the
 * user's timezone and the wall-clock math happens here, through croner so
 * DST transitions are handled the same way the schedulers handle them.
 */
export const NOTIFICATION_SNOOZE_PRESETS = [
  '1h',
  '3h',
  'tomorrow',
  'next-week',
] as const

export type NotificationSnoozePreset =
  (typeof NOTIFICATION_SNOOZE_PRESETS)[number]

export const DEFAULT_SNOOZE_TIMEZONE = 'America/Sao_Paulo'

/** Local hour the "tomorrow" and "next week" presets wake up at. */
export const SNOOZE_WAKE_HOUR = 9

const HOUR_MS = 60 * 60 * 1000

function safeTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return DEFAULT_SNOOZE_TIMEZONE
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return timeZone
  } catch {
    return DEFAULT_SNOOZE_TIMEZONE
  }
}

function nextRun(pattern: string, from: Date, timezone: string): Date {
  // A 5-field pattern with fixed minute/hour always has a next occurrence.
  return new Cron(pattern, { timezone }).nextRun(from) as Date
}

/**
 * When a notification snoozed `now` with `preset` comes back:
 * - `1h` / `3h`: relative to now;
 * - `tomorrow`: 09:00 of the next local day;
 * - `next-week`: 09:00 of the next local Monday after today.
 */
export function snoozeUntil(
  preset: NotificationSnoozePreset,
  now: Date,
  timeZone?: string | null,
): Date {
  if (preset === '1h') return new Date(now.getTime() + HOUR_MS)
  if (preset === '3h') return new Date(now.getTime() + 3 * HOUR_MS)

  const timezone = safeTimeZone(timeZone)
  // Next local midnight: "tomorrow" never resolves to later today.
  const midnight = nextRun('0 0 * * *', now, timezone)
  const from = new Date(midnight.getTime() - 1)
  return preset === 'tomorrow'
    ? nextRun(`0 ${SNOOZE_WAKE_HOUR} * * *`, from, timezone)
    : nextRun(`0 ${SNOOZE_WAKE_HOUR} * * 1`, from, timezone)
}
