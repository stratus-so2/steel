'use client'

import { useEffect, useState } from 'react'

/** Valor com atraso (busca enquanto digita). */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export interface SdTableState<F extends Record<string, unknown>> {
  search: string
  setSearch: (value: string) => void
  /** Busca já com debounce, pronta para a query. */
  q: string | undefined
  page: number
  setPage: (page: number) => void
  pageSize: number
  setPageSize: (size: number) => void
  sort: string
  order: 'asc' | 'desc'
  setSort: (sort: string, order: 'asc' | 'desc') => void
  filters: F
  setFilter: <K extends keyof F>(key: K, value: F[K]) => void
  clearFilters: () => void
  activeFilterCount: number
}

/**
 * Estado de uma tabela paginada no servidor: busca (com debounce), página,
 * tamanho, ordenação e filtros. Mudar busca/filtro/ordenação volta para a
 * página 1.
 */
export function useSdTableState<F extends Record<string, unknown>>(options: {
  sort: string
  order?: 'asc' | 'desc'
  pageSize?: number
  filters: F
}): SdTableState<F> {
  const [search, setSearchRaw] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSizeRaw] = useState(options.pageSize ?? 25)
  const [sort, setSortRaw] = useState(options.sort)
  const [order, setOrder] = useState<'asc' | 'desc'>(options.order ?? 'asc')
  const [filters, setFilters] = useState<F>(options.filters)
  const debounced = useDebouncedValue(search.trim())

  // A busca efetiva mudou: volta para a primeira página (o ajuste acontece
  // no render, sem efeito, comparando com a busca anterior).
  const [lastQ, setLastQ] = useState(debounced)
  if (lastQ !== debounced) {
    setLastQ(debounced)
    setPage(1)
  }

  const activeFilterCount = Object.entries(filters).filter(
    ([key, value]) =>
      value !== undefined &&
      value !== '' &&
      value !== null &&
      value !== options.filters[key],
  ).length

  return {
    search,
    setSearch: setSearchRaw,
    q: debounced || undefined,
    page,
    setPage,
    pageSize,
    setPageSize: (size) => {
      setPageSizeRaw(size)
      setPage(1)
    },
    sort,
    order,
    setSort: (next, nextOrder) => {
      setSortRaw(next)
      setOrder(nextOrder)
      setPage(1)
    },
    filters,
    setFilter: (key, value) => {
      setFilters((current) => ({ ...current, [key]: value }))
      setPage(1)
    },
    clearFilters: () => {
      setFilters(options.filters)
      setPage(1)
    },
    activeFilterCount,
  }
}
