/**
 * Formatting for the Steel AI usage pages. Money is US$ in pt-BR notation
 * (`US$ 1.234,56`); dates are UTC days — the clock of the AI quota — and are
 * always formatted with `timeZone: 'UTC'`, never the browser's.
 */

const usdCents = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Sub-dollar amounts keep up to 4 decimals (a single call costs cents). */
const usdSmall = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
})

const integer = new Intl.NumberFormat('pt-BR')

const compact = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatUsd(value: number): string {
  return Math.abs(value) > 0 && Math.abs(value) < 1
    ? usdSmall.format(value)
    : usdCents.format(value)
}

const usdWhole = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

/** Axis ticks: whole dollars from US$ 10 up, cents below. */
export function formatUsdTick(value: number): string {
  return Math.abs(value) >= 10 ? usdWhole.format(value) : usdCents.format(value)
}

export function formatInteger(value: number): string {
  return integer.format(value)
}

export function formatCompact(value: number): string {
  return compact.format(value)
}

/** `0.1234` → `12,3%`. */
export function formatShare(share: number): string {
  return `${(share * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

/** Signed % change (`+12,5%`, `−3%`); `null` = no previous base. */
export function formatChange(percent: number | null): string {
  if (percent === null) return 'sem base de comparação'
  const value = Math.abs(percent).toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
  })
  if (percent === 0) return '0%'
  return `${percent > 0 ? '+' : '−'}${value}%`
}

const dayMonth = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'UTC',
})

const longDay = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  timeZone: 'UTC',
})

const monthYear = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

const weekday = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  timeZone: 'UTC',
})

/** `YYYY-MM-DD` or ISO → Date at 00:00 UTC of that day. */
function asDate(value: string): Date {
  return new Date(value.length === 10 ? `${value}T00:00:00Z` : value)
}

export function formatDayMonth(value: string): string {
  return dayMonth.format(asDate(value))
}

export function formatLongDay(value: string): string {
  return longDay.format(asDate(value))
}

export function formatMonthYear(value: string): string {
  return monthYear.format(asDate(value))
}

export function formatWeekday(value: string): string {
  return weekday.format(asDate(value)).replace('.', '')
}

/** Inclusive label of an exclusive UTC range: `01/10 – 07/10`. */
export function formatRange(fromIso: string, toExclusiveIso: string): string {
  const last = new Date(asDate(toExclusiveIso).getTime() - 24 * 60 * 60 * 1000)
  return `${dayMonth.format(asDate(fromIso))} – ${dayMonth.format(last)}`
}
