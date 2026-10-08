'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { SearchResponseDTO } from '@/types/search'
import { apiFetch } from './_fetch'

export const GLOBAL_SEARCH_DEBOUNCE_MS = 180

/** `value`, but only after it stopped changing for `delayMs`. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

/**
 * Global search (Ctrl+K). Debounced; keeps the previous results while the
 * next query is in flight so the list does not flicker as the user types.
 */
export function useGlobalSearch(workspaceId: string, query: string) {
  const debounced = useDebouncedValue(query.trim(), GLOBAL_SEARCH_DEBOUNCE_MS)
  const result = useQuery({
    queryKey: ['global-search', workspaceId, debounced],
    queryFn: ({ signal }) =>
      apiFetch<SearchResponseDTO>(
        `/api/workspaces/${workspaceId}/search?q=${encodeURIComponent(debounced)}&limit=30`,
        { signal },
        'Erro ao buscar',
      ),
    enabled: Boolean(workspaceId) && debounced.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 15 * 1000,
  })
  return {
    ...result,
    debouncedQuery: debounced,
    isDebouncing: debounced !== query.trim(),
  }
}
