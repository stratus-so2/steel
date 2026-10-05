'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/src/hooks/_fetch'
import type { CrmCompetitorMetricsRange } from '@/src/schemas/crm-competitor.schema'
import type {
  CrmCompetitorAnalysisDTO,
  CrmCompetitorIdeaSetDTO,
} from '@/types/crm-competitor'

function basePath(workspaceId: string, competitorId: string): string {
  return `/api/workspaces/${workspaceId}/crm/competitors/${competitorId}`
}

/** Post-based comparison for the window; refetches when the range changes. */
export function useCrmCompetitorAnalysis(
  workspaceId: string,
  competitorId: string,
  range: CrmCompetitorMetricsRange,
) {
  const [data, setData] = useState<CrmCompetitorAnalysisDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    apiFetch<CrmCompetitorAnalysisDTO>(
      `${basePath(workspaceId, competitorId)}/analysis?range=${range}`,
      undefined,
      'Não foi possível carregar a análise.',
    )
      .then((value) => {
        if (!cancelled) setData(value)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Não foi possível carregar a análise.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [workspaceId, competitorId, range])

  return { data, isLoading, error }
}

/**
 * Latest AI idea set plus `generate`, which spends the workspace AI quota.
 * `generate` throws the API message so the screen can toast it.
 */
export function useCrmCompetitorIdeas(
  workspaceId: string,
  competitorId: string,
) {
  const [ideaSet, setIdeaSet] = useState<CrmCompetitorIdeaSetDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    apiFetch<CrmCompetitorIdeaSetDTO | null>(
      `${basePath(workspaceId, competitorId)}/ideas`,
    )
      .then((value) => {
        if (!cancelled) setIdeaSet(value)
      })
      .catch(() => {
        if (!cancelled) setIdeaSet(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [workspaceId, competitorId])

  const generate = useCallback(
    async (range: CrmCompetitorMetricsRange) => {
      setIsGenerating(true)
      try {
        const created = await apiFetch<CrmCompetitorIdeaSetDTO>(
          `${basePath(workspaceId, competitorId)}/ideas`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ range }),
          },
          'Não foi possível gerar as ideias.',
        )
        setIdeaSet(created)
        return created
      } finally {
        setIsGenerating(false)
      }
    },
    [workspaceId, competitorId],
  )

  return { ideaSet, isLoading, isGenerating, generate }
}
