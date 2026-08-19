'use client'

import { useCallback, useEffect, useState } from 'react'
import type {
  CrmProposalTemplateDTO,
  CrmProposalTemplateSectionDTO,
} from '@/types/crm-proposal-template'
import { apiFetch } from './_fetch'
import type { MutationResult } from './use-crm-proposal'

function collectionUrl(workspaceId: string): string {
  return `/api/workspaces/${workspaceId}/crm/proposal-templates`
}

function readError(json: unknown): string {
  const data = json as { message?: string }
  return data?.message ?? 'Não foi possível salvar.'
}

/** Lista os templates de proposta do workspace, com refetch manual. */
export function useCrmProposalTemplates(workspaceId: string) {
  const [templates, setTemplates] = useState<CrmProposalTemplateDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!workspaceId) return
    setIsLoading(true)
    try {
      const data = await apiFetch<CrmProposalTemplateDTO[]>(
        collectionUrl(workspaceId),
        undefined,
        'Não foi possível carregar os templates.',
      )
      setTemplates(data)
    } catch {
      setTemplates([])
    } finally {
      setIsLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { templates, isLoading, refetch }
}

export type CrmProposalTemplateSectionInput = {
  type: CrmProposalTemplateSectionDTO['type']
  order: number
  enabled: boolean
  defaultContent?: CrmProposalTemplateSectionDTO['defaultContent']
}

export async function createCrmProposalTemplate(
  workspaceId: string,
  input: {
    name: string
    description?: string
    logoUrl?: string
    sections?: CrmProposalTemplateSectionInput[]
  },
): Promise<MutationResult<CrmProposalTemplateDTO>> {
  try {
    const res = await fetch(collectionUrl(workspaceId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const json = await res.json()
    if (!res.ok || !json.success) return { ok: false, message: readError(json) }
    return { ok: true, data: json.data as CrmProposalTemplateDTO }
  } catch {
    return { ok: false, message: 'Erro de rede. Tente novamente.' }
  }
}

export async function updateCrmProposalTemplate(
  workspaceId: string,
  templateId: string,
  patch: Partial<{
    name: string
    description: string | null
    logoUrl: string | null
    sections: CrmProposalTemplateSectionInput[]
  }>,
): Promise<MutationResult<CrmProposalTemplateDTO>> {
  try {
    const res = await fetch(`${collectionUrl(workspaceId)}/${templateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const json = await res.json()
    if (!res.ok || !json.success) return { ok: false, message: readError(json) }
    return { ok: true, data: json.data as CrmProposalTemplateDTO }
  } catch {
    return { ok: false, message: 'Erro de rede. Tente novamente.' }
  }
}

export async function deleteCrmProposalTemplate(
  workspaceId: string,
  templateId: string,
): Promise<MutationResult<void>> {
  try {
    const res = await fetch(`${collectionUrl(workspaceId)}/${templateId}`, {
      method: 'DELETE',
    })
    const json = await res.json()
    if (!res.ok || !json.success) return { ok: false, message: readError(json) }
    return { ok: true }
  } catch {
    return { ok: false, message: 'Erro de rede. Tente novamente.' }
  }
}
