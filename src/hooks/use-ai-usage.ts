import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type {
  AiUsageAnalyticsDTO,
  AiUsageOverviewDTO,
  AiUsagePeriodPreset,
  AiUsageScope,
} from '@/types/ai-usage'
import { apiFetch } from './_fetch'

export interface AiUsageFilter {
  scope: AiUsageScope
  period: AiUsagePeriodPreset
  /** `YYYY-MM-DD` (UTC), only for `custom`. */
  from?: string
  to?: string
}

export type AiUsageExportView = 'rows' | 'model' | 'feature' | 'module' | 'user'

export const AI_USAGE_OVERVIEW_KEY = (workspaceId: string) =>
  ['ai-usage', workspaceId, 'overview'] as const

export const AI_USAGE_ANALYTICS_KEY = (
  workspaceId: string,
  filter: AiUsageFilter,
) => ['ai-usage', workspaceId, 'analytics', filter] as const

function filterParams(filter: AiUsageFilter): URLSearchParams {
  const params = new URLSearchParams({
    scope: filter.scope,
    period: filter.period,
  })
  if (filter.period === 'custom') {
    if (filter.from) params.set('from', filter.from)
    if (filter.to) params.set('to', filter.to)
  }
  return params
}

/** "Uso": the user's month and week vs the workspace quota. */
export function useAiUsageOverview(workspaceId: string) {
  return useQuery({
    queryKey: AI_USAGE_OVERVIEW_KEY(workspaceId),
    queryFn: () =>
      apiFetch<AiUsageOverviewDTO>(
        `/api/workspaces/${workspaceId}/ai/usage`,
        undefined,
        'Erro ao carregar o consumo de IA',
      ),
    staleTime: 60 * 1000,
  })
}

/**
 * "Análises": breakdowns of a period. Keeps the previous result while a new
 * filter loads, so the charts hold their frame instead of flashing.
 */
export function useAiUsageAnalytics(
  workspaceId: string,
  filter: AiUsageFilter,
  enabled = true,
) {
  return useQuery({
    queryKey: AI_USAGE_ANALYTICS_KEY(workspaceId, filter),
    queryFn: () =>
      apiFetch<AiUsageAnalyticsDTO>(
        `/api/workspaces/${workspaceId}/ai/usage/analytics?${filterParams(filter)}`,
        undefined,
        'Erro ao carregar as análises de IA',
      ),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  })
}

/** Download URL of the CSV export (the browser streams it to a file). */
export function aiUsageExportUrl(
  workspaceId: string,
  filter: AiUsageFilter,
  view: AiUsageExportView,
): string {
  const params = filterParams(filter)
  params.set('view', view)
  return `/api/workspaces/${workspaceId}/ai/usage/export?${params}`
}
