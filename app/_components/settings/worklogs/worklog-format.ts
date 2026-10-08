/**
 * Formatting of Ajustes › Exportações and Registros de trabalho. Dates are
 * always formatted in an explicit time zone (the workspace calendar's, or
 * São Paulo for exports) — never the browser's.
 */

const integer = new Intl.NumberFormat('pt-BR')
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export const EXPORT_TIMEZONE = 'America/Sao_Paulo'

export function formatInteger(value: number): string {
  return integer.format(value)
}

/** `1 h 30 min`, `45 min`, `0 min`. */
export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return '—'
  const total = Math.round(minutes)
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (hours === 0) return `${rest} min`
  return rest === 0
    ? `${integer.format(hours)} h`
    : `${integer.format(hours)} h ${rest} min`
}

/** `12,5 h`. */
export function formatHours(minutes: number): string {
  return `${decimal.format(minutes / 60)} h`
}

/** Ratio 0–1 → `37,5%`; `null` → `—`. */
export function formatPercent(ratio: number | null): string {
  if (ratio === null) return '—'
  return `${decimal.format(ratio * 100)}%`
}

export function formatDecimal(value: number | null): string {
  return value === null ? '—' : decimal.format(value)
}

/** Decimal string (`"1234.50"`) → `R$ 1.234,50`. */
export function formatMoney(value: string | null): string {
  if (value === null) return '—'
  return brl.format(Number(value))
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${decimal.format(value)} ${units[unit]}`
}

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>()

/** `08/10/2026 14:05` in `timeZone`. */
export function formatDateTime(iso: string, timeZone: string): string {
  let formatter = dateTimeFormatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    dateTimeFormatters.set(timeZone, formatter)
  }
  return formatter.format(new Date(iso)).replace(',', '')
}

/** `YYYY-MM-DD` → `08/10/2026` (a calendar day, no zone involved). */
export function formatDayKey(key: string): string {
  const [y, m, d] = key.split('-')
  return `${d}/${m}/${y}`
}

/** `YYYY-MM-DD` → `08/10`. */
export function formatDayMonth(key: string): string {
  const [, m, d] = key.split('-')
  return `${d}/${m}`
}
