'use client'

import { useCallback, useEffect, useState } from 'react'
import type { CrmLandingPageDTO } from '@/types/crm-landing-page'
import { apiFetch } from './_fetch'

export type MutationResult<T> = { ok: boolean; data?: T; message?: string }

function readError(json: unknown): string {
  const data = json as { message?: string }
  return data?.message ?? 'Não foi possível salvar.'
}

function baseUrl(workspaceId: string, pageId: string): string {
  return `/api/workspaces/${workspaceId}/crm/landing-pages/${pageId}`
}

/** Carrega uma landing page, com refetch manual — usado pelo builder. */
export function useCrmLandingPage(workspaceId: string, pageId: string) {
  const [page, setPage] = useState<CrmLandingPageDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiFetch<CrmLandingPageDTO>(
        baseUrl(workspaceId, pageId),
        undefined,
        'Não foi possível carregar a página.',
      )
      setPage(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro de rede.')
    } finally {
      setIsLoading(false)
    }
  }, [workspaceId, pageId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { page, isLoading, error, refetch }
}

/** PATCH parcial (autosave de título/html ou alternância de status). */
export async function saveCrmLandingPage(
  workspaceId: string,
  pageId: string,
  patch: { title?: string; html?: string; status?: 'DRAFT' | 'PUBLISHED' },
): Promise<MutationResult<CrmLandingPageDTO>> {
  try {
    const res = await fetch(baseUrl(workspaceId, pageId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const json = await res.json()
    if (!res.ok || !json.success) return { ok: false, message: readError(json) }
    return { ok: true, data: json.data as CrmLandingPageDTO }
  } catch {
    return { ok: false, message: 'Erro de rede. Tente novamente.' }
  }
}
