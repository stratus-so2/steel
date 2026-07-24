import type {
  ChartConfig,
  ViewConfig,
} from '@/src/schemas/crm-dashboard.schema'

export type Row = Record<string, unknown>
type Filter = ViewConfig['filters'][number]

const dateFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test(value)
}

/** Valor de uma célula como texto legível (para tabela e categorias). */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (typeof value === 'string' && isIsoDate(value)) {
    return dateFmt.format(new Date(value))
  }
  return String(value)
}

export function passesFilters(row: Row, filters: Filter[]): boolean {
  return filters.every((filter) => {
    const raw = row[filter.field]
    const text = Array.isArray(raw) ? raw.join(' ') : String(raw ?? '')
    const needle = (filter.value ?? '').toLowerCase()
    const hay = text.toLowerCase()
    switch (filter.operator) {
      case 'contains':
        return hay.includes(needle)
      case 'equals':
        return hay === needle
      case 'not_equals':
        return hay !== needle
      case 'is_empty':
        return raw === null || raw === undefined || text === ''
      case 'is_not_empty':
        return raw !== null && raw !== undefined && text !== ''
      default:
        return true
    }
  })
}

export function sortRows(rows: Row[], config: ViewConfig): Row[] {
  if (config.sort.length === 0) return rows
  return [...rows].sort((a, b) => {
    for (const { field, direction } of config.sort) {
      const cmp = String(a[field] ?? '').localeCompare(
        String(b[field] ?? ''),
        'pt-BR',
        { numeric: true },
      )
      if (cmp !== 0) return direction === 'asc' ? cmp : -cmp
    }
    return 0
  })
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const SINGLE_SERIES = 'Total'

export type ChartData = {
  categories: string[]
  seriesKeys: string[]
  valueAt: (category: string, series: string) => number
  totalOf: (category: string) => number
}

/**
 * Agrega registros conforme a config do chart. Agregação automática:
 * soma quando o campo de valor é numérico, senão contagem de registros.
 */
export function aggregateChart(rows: Row[], config: ChartConfig): ChartData {
  const empty: ChartData = {
    categories: [],
    seriesKeys: [],
    valueAt: () => 0,
    totalOf: () => 0,
  }
  if (!config.xField) return empty

  const filtered = rows.filter((row) => passesFilters(row, config.filters))
  const useSum =
    Boolean(config.yField) &&
    filtered.some((row) => toNumber(row[config.yField as string]) !== null)

  const order: string[] = []
  const map = new Map<string, Map<string, number>>()
  const seriesSet = new Set<string>()

  for (const row of filtered) {
    const category = formatValue(row[config.xField])
    const series = config.groupBy
      ? formatValue(row[config.groupBy])
      : SINGLE_SERIES
    seriesSet.add(series)
    if (!map.has(category)) {
      map.set(category, new Map())
      order.push(category)
    }
    const inner = map.get(category) as Map<string, number>
    const value = useSum ? (toNumber(row[config.yField as string]) ?? 0) : 1
    inner.set(series, (inner.get(series) ?? 0) + value)
  }

  const totalOf = (category: string): number => {
    const inner = map.get(category)
    if (!inner) return 0
    let sum = 0
    for (const v of inner.values()) sum += v
    return sum
  }

  let categories = [...order]
  if (config.ySort !== 'none') {
    categories.sort((a, b) =>
      config.ySort === 'asc'
        ? totalOf(a) - totalOf(b)
        : totalOf(b) - totalOf(a),
    )
  } else if (config.xSort !== 'none') {
    categories.sort((a, b) => {
      const cmp = a.localeCompare(b, 'pt-BR', { numeric: true })
      return config.xSort === 'asc' ? cmp : -cmp
    })
  }

  if (config.omitZero || config.hideEmpty) {
    categories = categories.filter((c) => totalOf(c) !== 0)
  }

  if (config.cumulative) {
    const running = new Map<string, number>()
    for (const category of categories) {
      const inner = map.get(category) as Map<string, number>
      for (const series of seriesSet) {
        const prev = running.get(series) ?? 0
        const next = (inner.get(series) ?? 0) + prev
        running.set(series, next)
        inner.set(series, next)
      }
    }
  }

  return {
    categories,
    seriesKeys: [...seriesSet],
    valueAt: (category, series) => map.get(category)?.get(series) ?? 0,
    totalOf,
  }
}

/** Soma o campo numérico configurado, ou conta registros na ausência dele. */
function sumOrCount(rows: Row[], config: ChartConfig): number {
  if (!config.yField) return rows.length
  let sum = 0
  let sawNumber = false
  for (const row of rows) {
    const n = toNumber(row[config.yField])
    if (n !== null) {
      sum += n
      sawNumber = true
    }
  }
  return sawNumber ? sum : rows.length
}

/** Valor único do widget "aggregate" (soma do campo numérico ou contagem). */
export function aggregateTotal(rows: Row[], config: ChartConfig): number {
  const filtered = rows.filter((row) => passesFilters(row, config.filters))
  return sumOrCount(filtered, config)
}

const COMPARE_RANGE_DAYS: Record<
  NonNullable<ChartConfig['compareRange']>,
  number
> = {
  '7d': 7,
  '30d': 30,
}

export type CompareResult = {
  current: number
  previous: number
  changePct: number | null
}

/**
 * Compara o total do período atual (`compareRange` dias) com o período
 * imediatamente anterior (mesmo tamanho). `null` quando `compareRange` não
 * está configurado. Campo de data: `date` para a fonte "socials" (série
 * diária), `createdAt` para as demais fontes (DTOs de registro).
 */
export function aggregateCompare(
  rows: Row[],
  config: ChartConfig,
): CompareResult | null {
  if (!config.compareRange) return null

  const dateField = config.source === 'socials' ? 'date' : 'createdAt'
  const days = COMPARE_RANGE_DAYS[config.compareRange]
  const now = Date.now()
  const dayMs = 86_400_000
  const currentStart = now - days * dayMs
  const previousStart = now - days * 2 * dayMs

  const filtered = rows.filter((row) => passesFilters(row, config.filters))
  const currentRows: Row[] = []
  const previousRows: Row[] = []

  for (const row of filtered) {
    const raw = row[dateField]
    if (typeof raw !== 'string') continue
    const t = new Date(raw).getTime()
    if (Number.isNaN(t)) continue
    if (t >= currentStart && t <= now) currentRows.push(row)
    else if (t >= previousStart && t < currentStart) previousRows.push(row)
  }

  const current = sumOrCount(currentRows, config)
  const previous = sumOrCount(previousRows, config)
  const changePct =
    previous === 0 ? null : ((current - previous) / previous) * 100

  return { current, previous, changePct }
}
