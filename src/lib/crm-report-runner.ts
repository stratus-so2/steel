import {
  CRM_REPORT_SOURCE_LABELS,
  crmReportFieldLabel,
} from '@/src/config/crm-report-fields'
import {
  CRM_REPORT_SOURCES,
  type CrmJoinQuery,
  type CrmReportAggregation,
  type CrmReportColumn,
  type CrmReportData,
  type CrmReportFilter,
  type CrmReportGroup,
  type CrmReportQuery,
  type CrmReportSort,
  type CrmReportSource,
  type CrmUnionQuery,
} from '@/src/schemas/crm-report.schema'

export function isCrmReportSource(value: string): value is CrmReportSource {
  return (CRM_REPORT_SOURCES as readonly string[]).includes(value)
}

/**
 * Engine de relatórios: combina uma ou mais fontes (JOIN ou UNION), aplica
 * filtros por dataset, agrupa com agregações (count/sum/avg/min/max), ordena
 * e projeta as colunas finais — sempre com rótulos amigáveis. Roda em memória
 * sobre linhas já buscadas (via `Service.list()` de cada entidade), não SQL.
 */

export type CrmReportRow = Record<string, unknown>
export type CrmReportRowsByAlias = Record<string, CrmReportRow[]>

function asText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.join(' ')
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  return String(value)
}

function asNumber(value: unknown): number | null {
  if (Array.isArray(value) || value === null || value === undefined) {
    return null
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function passesFilters(row: CrmReportRow, filters: CrmReportFilter[]): boolean {
  return filters.every((filter) => {
    const hay = asText(row[filter.field]).toLowerCase()
    const needle = (filter.value ?? '').toLowerCase()
    switch (filter.operator) {
      case 'contains':
        return hay.includes(needle)
      case 'equals':
        return hay === needle
      case 'not_equals':
        return hay !== needle
      case 'is_empty':
        return hay === ''
      case 'is_not_empty':
        return hay !== ''
      default:
        return true
    }
  })
}

/** Prefixa todas as chaves de uma linha com o alias do dataset. */
function namespace(alias: string, row: CrmReportRow): CrmReportRow {
  const out: CrmReportRow = {}
  for (const [k, v] of Object.entries(row)) out[`${alias}.${k}`] = v
  return out
}

function sortRows(
  rows: CrmReportRow[],
  sort: CrmReportSort | null | undefined,
): CrmReportRow[] {
  if (!sort) return rows
  const dir = sort.direction === 'desc' ? -1 : 1
  return [...rows].sort((a, b) => {
    const an = asNumber(a[sort.field])
    const bn = asNumber(b[sort.field])
    if (an !== null && bn !== null) return (an - bn) * dir
    return asText(a[sort.field]).localeCompare(asText(b[sort.field])) * dir
  })
}

/** Aplica os filtros próprios de cada dataset. */
function filterDatasets(
  query: CrmReportQuery,
  rowsByAlias: CrmReportRowsByAlias,
): CrmReportRowsByAlias {
  const out: CrmReportRowsByAlias = {}
  for (const ds of query.datasets) {
    out[ds.alias] = (rowsByAlias[ds.alias] ?? []).filter((r) =>
      passesFilters(r, ds.filters),
    )
  }
  return out
}

/** Combina os datasets de um JOIN começando pelo dataset base (datasets[0]). */
function combineJoin(
  query: CrmJoinQuery,
  filtered: CrmReportRowsByAlias,
): CrmReportRow[] {
  const baseAlias = query.datasets[0].alias
  let combined: CrmReportRow[] = (filtered[baseAlias] ?? []).map((r) =>
    namespace(baseAlias, r),
  )

  for (const join of query.joins ?? []) {
    const index = new Map<string, CrmReportRow[]>()
    for (const rr of filtered[join.rightAlias] ?? []) {
      const key = asText(rr[join.rightField])
      const bucket = index.get(key)
      if (bucket) bucket.push(rr)
      else index.set(key, [rr])
    }

    const next: CrmReportRow[] = []
    for (const row of combined) {
      const matches = index.get(
        asText(row[`${join.leftAlias}.${join.leftField}`]),
      )
      if (!matches || matches.length === 0) {
        if (join.type === 'left') next.push(row)
        continue
      }
      for (const rr of matches) {
        next.push({ ...row, ...namespace(join.rightAlias, rr) })
      }
    }
    combined = next
  }

  return combined
}

/** Empilha os datasets de um UNION mapeando as colunas de cada fonte. */
function combineUnion(
  query: CrmUnionQuery,
  filtered: CrmReportRowsByAlias,
): CrmReportRow[] {
  const out: CrmReportRow[] = []
  for (const ds of query.datasets) {
    for (const raw of filtered[ds.alias] ?? []) {
      const row: CrmReportRow = {}
      for (const col of query.columns) {
        const field = col.fields[ds.alias]
        row[col.key] = field ? raw[field] : null
      }
      if (query.includeSource)
        row.__source = CRM_REPORT_SOURCE_LABELS[ds.source]
      out.push(row)
    }
  }
  return out
}

/** Agrupa por `group.by` e calcula as agregações. */
function aggregate(
  rows: CrmReportRow[],
  group: CrmReportGroup,
): CrmReportRow[] {
  const groups = new Map<string, { key: CrmReportRow; rows: CrmReportRow[] }>()
  for (const row of rows) {
    const id = group.by.map((field) => asText(row[field])).join(' ')
    let entry = groups.get(id)
    if (!entry) {
      const key: CrmReportRow = {}
      for (const field of group.by) key[field] = row[field]
      entry = { key, rows: [] }
      groups.set(id, entry)
    }
    entry.rows.push(row)
  }

  return [...groups.values()].map(({ key, rows: groupRows }) => {
    const out: CrmReportRow = { ...key }
    for (const agg of group.aggregations)
      out[agg.alias] = compute(agg, groupRows)
    return out
  })
}

function compute(agg: CrmReportAggregation, rows: CrmReportRow[]): number {
  if (agg.fn === 'count') return rows.length
  const nums = rows
    .map((r) => (agg.field ? asNumber(r[agg.field]) : null))
    .filter((n): n is number => n !== null)
  if (nums.length === 0) return 0
  switch (agg.fn) {
    case 'sum':
      return nums.reduce((a, b) => a + b, 0)
    case 'avg':
      return nums.reduce((a, b) => a + b, 0) / nums.length
    case 'min':
      return Math.min(...nums)
    case 'max':
      return Math.max(...nums)
    default:
      return 0
  }
}

/** Desambigua rótulos repetidos com sufixo " (2)", " (3)"… */
function dedupeLabels(columns: CrmReportColumn[]): CrmReportColumn[] {
  const seen = new Map<string, number>()
  return columns.map((col) => {
    const count = (seen.get(col.label) ?? 0) + 1
    seen.set(col.label, count)
    return count === 1 ? col : { ...col, label: `${col.label} (${count})` }
  })
}

/** Constrói o rótulo de uma chave namespaced "alias.field" (modo join). */
function joinColumnLabel(
  key: string,
  aliasSource: Map<string, CrmReportSource>,
  multiDataset: boolean,
): string {
  const dot = key.indexOf('.')
  if (dot === -1) return key
  const source = aliasSource.get(key.slice(0, dot))
  if (!source) return key
  const label = crmReportFieldLabel(source, key.slice(dot + 1))
  return multiDataset ? `${CRM_REPORT_SOURCE_LABELS[source]} · ${label}` : label
}

/** Monta as colunas de saída (com rótulos) a partir das chaves e do grupo. */
function outputColumns(
  keys: string[],
  group: CrmReportGroup | undefined,
  labelOf: (key: string) => string,
): CrmReportColumn[] {
  const cols: CrmReportColumn[] = group
    ? [
        ...group.by.map((key) => ({ key, label: labelOf(key) })),
        ...group.aggregations.map((agg) => ({
          key: agg.alias,
          label: agg.alias,
        })),
      ]
    : keys.map((key) => ({ key, label: labelOf(key) }))
  return dedupeLabels(cols)
}

/** Projeta cada linha nas chaves das colunas finais. */
function project(
  rows: CrmReportRow[],
  columns: CrmReportColumn[],
): CrmReportRow[] {
  return rows.map((row) => {
    const out: CrmReportRow = {}
    for (const col of columns) out[col.key] = row[col.key]
    return out
  })
}

/** Executa a query: combina fontes, agrupa/agrega, ordena e projeta colunas. */
export function runCrmReportQuery(
  query: CrmReportQuery,
  rowsByAlias: CrmReportRowsByAlias,
): CrmReportData {
  const filtered = filterDatasets(query, rowsByAlias)

  let labelOf: (key: string) => string
  let columnKeys: string[]
  let combined: CrmReportRow[]

  if (query.mode === 'join') {
    const aliasSource = new Map<string, CrmReportSource>(
      query.datasets.map((d) => [d.alias, d.source]),
    )
    const multi = query.datasets.length > 1
    labelOf = (key) => joinColumnLabel(key, aliasSource, multi)
    columnKeys = query.columns
    combined = combineJoin(query, filtered)
  } else {
    const labels = new Map<string, string>(
      query.columns.map((c) => [c.key, c.label]),
    )
    if (query.includeSource) labels.set('__source', 'Origem')
    labelOf = (key) => labels.get(key) ?? key
    columnKeys = [
      ...query.columns.map((c) => c.key),
      ...(query.includeSource ? ['__source'] : []),
    ]
    combined = combineUnion(query, filtered)
  }

  const columns = outputColumns(columnKeys, query.group, labelOf)

  const aggregated = query.group ? aggregate(combined, query.group) : combined
  const sorted = sortRows(aggregated, query.sort)
  const rows = project(sorted, columns)

  return {
    columns,
    rows,
    grouped: Boolean(query.group),
    total: query.group ? combined.length : rows.length,
  }
}
