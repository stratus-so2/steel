import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { WorklogPeriodPreset } from '@/src/lib/productivity/period'
import type { ProductivityDTO, WorklogListDTO } from '@/types/worklog'
import { apiFetch } from './_fetch'

/** Ajustes › Registros de trabalho: entries, indicators and their CSVs. */

export interface WorklogPeriodFilter {
  period: WorklogPeriodPreset
  from?: string
  to?: string
  userId?: string
}

export interface WorklogFilter extends WorklogPeriodFilter {
  ticket?: string
  billable?: 'true' | 'false'
  source?: 'TIMER' | 'MANUAL'
  page?: number
}

/** Query string with only the filled fields (empty strings are dropped). */
export function worklogSearch(filter: object): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filter)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const text = params.toString()
  return text ? `?${text}` : ''
}

export function worklogExportUrl(
  workspaceId: string,
  filter: WorklogFilter,
): string {
  const { page: _page, ...rest } = filter
  return `/api/workspaces/${workspaceId}/worklogs/export${worklogSearch(rest)}`
}

export function productivityExportUrl(
  workspaceId: string,
  filter: WorklogPeriodFilter,
): string {
  return `/api/workspaces/${workspaceId}/worklogs/productivity/export${worklogSearch(filter)}`
}

export function useWorklogs(
  workspaceId: string,
  filter: WorklogFilter,
  enabled = true,
) {
  return useQuery({
    queryKey: ['worklogs', workspaceId, filter],
    queryFn: () =>
      apiFetch<WorklogListDTO>(
        `/api/workspaces/${workspaceId}/worklogs${worklogSearch(filter)}`,
        undefined,
        'Erro ao carregar os registros de trabalho',
      ),
    enabled: Boolean(workspaceId) && enabled,
    placeholderData: keepPreviousData,
  })
}

export function useProductivity(
  workspaceId: string,
  filter: WorklogPeriodFilter,
  enabled = true,
) {
  return useQuery({
    queryKey: ['worklogs-productivity', workspaceId, filter],
    queryFn: () =>
      apiFetch<ProductivityDTO>(
        `/api/workspaces/${workspaceId}/worklogs/productivity${worklogSearch(filter)}`,
        undefined,
        'Erro ao carregar os indicadores',
      ),
    enabled: Boolean(workspaceId) && enabled,
    placeholderData: keepPreviousData,
  })
}
