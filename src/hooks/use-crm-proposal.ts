'use client'

import { useCallback, useEffect, useState } from 'react'
import type {
  CrmProposalDTO,
  CrmProposalMetricsDTO,
  CrmProposalSectionDTO,
  CrmProposalStatusDTO,
} from '@/types/crm-proposal'
import { apiFetch } from './_fetch'

export type MutationResult<T> = { ok: boolean; data?: T; message?: string }

function readError(json: unknown): string {
  const data = json as {
    message?: string
    error?: { details?: { fieldErrors?: Record<string, string[]> } }
  }
  const fieldErrors = data?.error?.details?.fieldErrors
  if (fieldErrors) {
    const parts = Object.entries(fieldErrors)
      .filter(([, messages]) => messages?.length)
      .map(([field, messages]) => `${field}: ${messages[0]}`)
    if (parts.length > 0) return parts.join(' · ')
  }
  return data?.message ?? 'Não foi possível salvar.'
}

function collectionUrl(workspaceId: string): string {
  return `/api/workspaces/${workspaceId}/crm/proposals`
}

function baseUrl(workspaceId: string, proposalId: string): string {
  return `${collectionUrl(workspaceId)}/${proposalId}`
}

/** Carrega uma proposta, com refetch manual — usado pelo builder. */
export function useCrmProposal(workspaceId: string, proposalId: string) {
  const [proposal, setProposal] = useState<CrmProposalDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    // Sem id ainda (proposta nova, não persistida) — nada para buscar.
    if (!proposalId) {
      setProposal(null)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiFetch<CrmProposalDTO>(
        baseUrl(workspaceId, proposalId),
        undefined,
        'Não foi possível carregar a proposta.',
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

export type CreateCrmProposalInput = {
  name: string
  templateId?: string
  companyId?: string
  contactId?: string
  opportunityId?: string
  responsibleId: string
  validUntil?: string
  sections?: Array<{
    type: CrmProposalSectionDTO['type']
    order: number
    enabled: boolean
    content: CrmProposalSectionDTO['content']
  }>
}

export async function createCrmProposal(
  workspaceId: string,
  input: CreateCrmProposalInput,
): Promise<MutationResult<CrmProposalDTO>> {
  try {
    const res = await fetch(collectionUrl(workspaceId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const json = await res.json()
    if (!res.ok || !json.success) return { ok: false, message: readError(json) }
    return { ok: true, data: json.data as CrmProposalDTO }
  } catch {
    return { ok: false, message: 'Erro de rede. Tente novamente.' }
  }
}

export type PatchCrmProposalInput = Partial<{
  name: string
  companyId: string | null
  contactId: string | null
  opportunityId: string | null
  responsibleId: string
  validUntil: string | null
  status: CrmProposalStatusDTO
  sections: Array<{
    type: CrmProposalSectionDTO['type']
    order: number
    enabled: boolean
    content: CrmProposalSectionDTO['content']
  }>
}>

/** PATCH parcial (dados do topo e/ou substituição completa de `sections`). */
export async function saveCrmProposal(
  workspaceId: string,
  proposalId: string,
  patch: PatchCrmProposalInput,
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

export async function deleteCrmProposal(
  workspaceId: string,
  proposalId: string,
): Promise<MutationResult<void>> {
  try {
    const res = await fetch(baseUrl(workspaceId, proposalId), {
      method: 'DELETE',
    })
    const json = await res.json()
    if (!res.ok || !json.success) return { ok: false, message: readError(json) }
    return { ok: true }
  } catch {
    return { ok: false, message: 'Erro de rede. Tente novamente.' }
  }
}

/** Transiciona DRAFT → SENT, habilitando o link público. */
export async function sendCrmProposal(
  workspaceId: string,
  proposalId: string,
): Promise<MutationResult<CrmProposalDTO>> {
  try {
    const res = await fetch(`${baseUrl(workspaceId, proposalId)}/send`, {
      method: 'POST',
    })
    const json = await res.json()
    if (!res.ok || !json.success) return { ok: false, message: readError(json) }
    return { ok: true, data: json.data as CrmProposalDTO }
  } catch {
    return { ok: false, message: 'Erro de rede. Tente novamente.' }
  }
}

/** Gera um CrmProposalTemplate a partir das seções atuais da proposta. */
export async function saveCrmProposalAsTemplate(
  workspaceId: string,
  proposalId: string,
): Promise<MutationResult<{ id: string }>> {
  try {
    const res = await fetch(
      `${baseUrl(workspaceId, proposalId)}/save-as-template`,
      { method: 'POST' },
    )
    const json = await res.json()
    if (!res.ok || !json.success) return { ok: false, message: readError(json) }
    return { ok: true, data: json.data as { id: string } }
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

/** Sobe uma imagem (capa, galeria, assinatura) e devolve a URL pública no MinIO. */
export async function uploadCrmProposalImage(
  workspaceId: string,
  file: File,
): Promise<MutationResult<{ url: string }>> {
  try {
    const res = await fetch(
      `/api/workspaces/${workspaceId}/crm/proposals/images`,
      {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      },
    )
    const json = await res.json()
    if (!res.ok || !json.success) return { ok: false, message: readError(json) }
    return { ok: true, data: json.data as { url: string } }
  } catch {
    return { ok: false, message: 'Erro de rede. Tente novamente.' }
  }
}
