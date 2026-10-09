/**
 * Send window of a CRM campaign, in the São Paulo timezone. Hours are
 * `[startHour, endHour)`; a window that crosses midnight (22 → 6) is
 * allowed. `null` hours mean "any time". Pure — the clock is an argument.
 */

export const CAMPAIGN_TIMEZONE = 'America/Sao_Paulo'

export interface SendWindow {
  startHour: number | null
  endHour: number | null
  weekdaysOnly: boolean
}

const HOUR_MS = 60 * 60 * 1000

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CAMPAIGN_TIMEZONE,
  hour: 'numeric',
  hourCycle: 'h23',
  weekday: 'short',
})

function localParts(at: Date): { hour: number; weekday: string } {
  const parts = formatter.formatToParts(at)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon'
  return { hour, weekday }
}

function hourInWindow(hour: number, start: number, end: number): boolean {
  if (start < end) return hour >= start && hour < end
  // Crosses midnight (e.g. 22 → 6).
  return hour >= start || hour < end
}

export function isWithinSendWindow(at: Date, window: SendWindow): boolean {
  const { hour, weekday } = localParts(at)
  if (window.weekdaysOnly && (weekday === 'Sat' || weekday === 'Sun')) {
    return false
  }
  if (window.startHour === null || window.endHour === null) return true
  return hourInWindow(hour, window.startHour, window.endHour)
}

/**
 * The first moment at or after `at` inside the window: `at` itself when it
 * is already inside, otherwise the start of the next open hour (searched up
 * to 8 days ahead, which covers any weekly window).
 */
export function nextSendWindowOpen(at: Date, window: SendWindow): Date {
  if (isWithinSendWindow(at, window)) return at
  const nextHour = new Date(Math.floor(at.getTime() / HOUR_MS + 1) * HOUR_MS)
  for (let i = 0; i < 24 * 8; i += 1) {
    const candidate = new Date(nextHour.getTime() + i * HOUR_MS)
    if (isWithinSendWindow(candidate, window)) return candidate
  }
  return at
}
