'use client'

import { useCallback, useEffect, useState } from 'react'
import type { CrmDocumentTemplateDTO } from '@/types/crm-document-template'
import { apiFetch } from './_fetch'

function baseUrl(workspaceId: string): string {
  return `/api/workspaces/${workspaceId}/crm/document-templates`
}

/** Lista os templates de documento do workspace, com refetch manual. */
export function useCrmDocumentTemplates(workspaceId: string) {
  const [templates, setTemplates] = useState<CrmDocumentTemplateDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await apiFetch<CrmDocumentTemplateDTO[]>(
        baseUrl(workspaceId),
        undefined,
        'Não foi possível carregar os templates.',
      )
      setTemplates(data ?? [])
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

/** Cria um template a partir do conteúdo atual de um documento. */
export async function createCrmDocumentTemplate(
  workspaceId: string,
  input: { title: string; content: string; contentJson?: string; type: string },
): Promise<CrmDocumentTemplateDTO | null> {
  try {
    const res = await fetch(baseUrl(workspaceId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const json = await res.json()
    return res.ok && json.success ? (json.data as CrmDocumentTemplateDTO) : null
  } catch {
    return null
  }
}

/** Remove (soft-delete) um template. */
export async function deleteCrmDocumentTemplate(
  workspaceId: string,
  templateId: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl(workspaceId)}/${templateId}`, {
      method: 'DELETE',
    })
    return res.ok
  } catch {
    return false
  }
}
