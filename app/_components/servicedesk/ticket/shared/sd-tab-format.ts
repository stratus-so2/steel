/** Formatação comum às abas do chamado (pt-BR). */

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const DATE_TIME = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const DATE = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const TIME = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
})

/** Decimal serializado (`"129.90"`) em reais. */
export function formatBRL(value: string | number): string {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? BRL.format(n) : String(value)
}

/** Quantidade decimal sem zeros desnecessários (`"1.50"` → `1,5`). */
export function formatQuantity(value: string | number): string {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return String(value)
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : DATE_TIME.format(d)
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : DATE.format(d)
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : TIME.format(d)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** `YYYY-MM-DD` (valor de `<input type="date">`) de um ISO. */
export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

/** `<input type="date">` → ISO ao meio-dia UTC (evita virar o dia por fuso). */
export function fromDateInput(value: string): string | null {
  if (!value) return null
  return new Date(`${value}T12:00:00.000Z`).toISOString()
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
  ).toUpperCase()
}

/** `"1,5"` / `"1.50"` → número (NaN se inválido). */
export function parseSdDecimal(value: string): number {
  const v = value.trim()
  if (!v) return Number.NaN
  // Com vírgula, o ponto é separador de milhar (`1.234,50`).
  return Number(v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v)
}
