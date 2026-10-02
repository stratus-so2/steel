/**
 * Client-side search, sorting and pagination for the risk screens.
 *
 * `SdDataTable` is controlled and expects its caller to paginate; the two risk
 * routes (`/risk/tickets` and `/risk/clusters`) only accept `level`/`status`
 * and `limit` — they have no `page`, `sort` or `q`. Rather than change the API
 * contract for one screen, the list (at most 50 and 30 items) is sliced here.
 * If the prediction ever yields hundreds of tickets, this becomes real
 * pagination in the service.
 */

export type SdSortable = string | number | null | undefined

export interface SdLocalTableOptions<T> {
  /** Already-debounced search (`q` from `useSdTableState`). */
  q?: string
  /** The text of each row the search looks into. */
  searchText: (row: T) => string
  sort: string
  order: 'asc' | 'desc'
  /** Comparable value of each sortable column. */
  sortValue: (row: T, sort: string) => SdSortable
  page: number
  pageSize: number
}

export interface SdLocalTableResult<T> {
  rows: T[]
  total: number
  /** Effective page: the list can shrink and leave the current page empty. */
  page: number
}

export function sdCompareSortable(a: SdSortable, b: SdSortable): number {
  // Empty always sorts last, whichever direction is asked for: a column with
  // no value at the top of the risk queue tells nobody anything.
  if (a === b) return 0
  if (a === null || a === undefined) return 1
  if (b === null || b === undefined) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'pt-BR', { numeric: true })
}

export function sdLocalTable<T>(
  all: T[],
  options: SdLocalTableOptions<T>,
): SdLocalTableResult<T> {
  const { q, searchText, sort, order, page, pageSize } = options
  const needle = q?.trim().toLowerCase()
  const filtered = needle
    ? all.filter((row) => searchText(row).toLowerCase().includes(needle))
    : all

  const direction = order === 'desc' ? -1 : 1
  const sorted = [...filtered].sort(
    (a, b) =>
      direction *
      sdCompareSortable(options.sortValue(a, sort), options.sortValue(b, sort)),
  )

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const current = Math.min(Math.max(page, 1), pageCount)
  const from = (current - 1) * pageSize
  return {
    rows: sorted.slice(from, from + pageSize),
    total: sorted.length,
    page: current,
  }
}
