/**
 * Busca, ordenação e paginação **no cliente** para as telas de risco.
 *
 * `SdDataTable` é controlada e espera que quem usa pagine; as duas rotas de
 * risco (`/risk/tickets` e `/risk/clusters`) só aceitam `level`/`status` e
 * `limit` — não têm `page`, `sort` nem `q`. Em vez de mexer no contrato da
 * API por causa de uma tela, a lista (no máximo 50 e 30 itens) é recortada
 * aqui. Se um dia a previsão passar a render centenas de chamados, isto vira
 * paginação de verdade no service.
 */

export type SdSortable = string | number | null | undefined

export interface SdLocalTableOptions<T> {
  /** Busca já com debounce (`q` do `useSdTableState`). */
  q?: string
  /** Texto de cada linha onde a busca procura. */
  searchText: (row: T) => string
  sort: string
  order: 'asc' | 'desc'
  /** Valor comparável de cada coluna ordenável. */
  sortValue: (row: T, sort: string) => SdSortable
  page: number
  pageSize: number
}

export interface SdLocalTableResult<T> {
  rows: T[]
  total: number
  /** Página efetiva: a lista pode encurtar e deixar a página atual vazia. */
  page: number
}

export function sdCompareSortable(a: SdSortable, b: SdSortable): number {
  // Vazio sempre por último, independente da direção: uma coluna sem valor
  // no topo da fila de risco não diz nada a ninguém.
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
