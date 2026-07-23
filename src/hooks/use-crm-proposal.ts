'use client'

import { useCallback, useEffect, useState } from 'react'
import type {
  CrmProposalDTO,
  CrmProposalMetricsDTO,
} from '@/types/crm-proposal'
import { apiFetch } from './_fetch'

export type MutationResult<T> = { ok: boolean; data?: T; message?: string }

function readError(json: unknown): string {
  const data = json as { message?: string }
  return data?.message ?? 'Não foi possível salvar.'
}

function baseUrl(workspaceId: string, proposalId: string): string {
  return `/api/workspaces/${workspaceId}/crm/proposals/${proposalId}`
}

/** Carrega uma proposta, com refetch manual — usado pelo editor. */
export function useCrmProposal(workspaceId: string, proposalId: string) {
  const [proposal, setProposal] = useState<CrmProposalDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiFetch<CrmProposalDTO>(
        baseUrl(workspaceId, proposalId),
        undefined,
        'Não foi possível carregar o documento.',
      )
      setProposal(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro de rede.')
    } finally {
      setIsLoading(false)
    }
  }, [workspaceId, proposalId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { proposal, isLoading, error, refetch }
}

/** PATCH parcial (autosave de conteúdo/título ou alternância de status). */
export async function saveCrmProposal(
  workspaceId: string,
  proposalId: string,
  patch: {
    title?: string
    content?: string
    contentJson?: string
    type?: string
    status?: 'DRAFT' | 'PUBLISHED'
  },
): Promise<MutationResult<CrmProposalDTO>> {
  try {
    const res = await fetch(baseUrl(workspaceId, proposalId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const json = await res.json()
    if (!res.ok || !json.success) return { ok: false, message: readError(json) }
    return { ok: true, data: json.data as CrmProposalDTO }
  } catch {
    return { ok: false, message: 'Erro de rede. Tente novamente.' }
  }
}

/** Busca as métricas de leitura agregadas + lista de visitas. */
export async function getCrmProposalMetrics(
  workspaceId: string,
  proposalId: string,
): Promise<CrmProposalMetricsDTO | null> {
  try {
    return await apiFetch<CrmProposalMetricsDTO>(
      `${baseUrl(workspaceId, proposalId)}/metrics`,
      undefined,
      'Não foi possível carregar as métricas.',
    )
  } catch {
    return null
  }
}
