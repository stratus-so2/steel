'use client'

import { useCallback, useEffect, useState } from 'react'

type ApiResponse<T> = {
  success: boolean
  data?: T
  message?: string
}

/**
 * Busca a lista de um recurso do CRM
 * (`/api/workspaces/<workspaceId>/crm/<resource>`), com refetch manual.
 */
export function useCrmResourceList<T>(workspaceId: string, resource: string) {
  const [items, setItems] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!workspaceId) return
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/crm/${resource}`,
      )
      const json = (await response.json()) as ApiResponse<T[]>
      if (!response.ok || !json.success || !json.data) {
        setError(json?.message ?? 'Não foi possível carregar os dados.')
        return
      }
      setItems(json.data)
    } catch {
      setError('Erro de rede. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }, [workspaceId, resource])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { items, isLoading, error, refetch }
}

export type MutationResult<T> = {
  ok: boolean
  data?: T
  /** Mensagem legível (com erros por campo concatenados, quando houver). */
  message?: string
}

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

/** Cria um registro (POST). Usado pela linha vazia de criação inline. */
export async function createCrmResource<T>(
  workspaceId: string,
  resource: string,
  payload: Record<string, unknown>,
): Promise<MutationResult<T>> {
  try {
    const response = await fetch(
      `/api/workspaces/${workspaceId}/crm/${resource}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    )
    const json = await response.json()
    if (!response.ok || !json.success) {
      return { ok: false, message: readError(json) }
    }
    return { ok: true, data: json.data as T }
  } catch {
    return { ok: false, message: 'Erro de rede. Tente novamente.' }
  }
}

/** Atualiza um campo (PATCH parcial). Usado pela edição inline (auto-save). */
export async function updateCrmResource<T>(
  workspaceId: string,
  resource: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<MutationResult<T>> {
  try {
    const response = await fetch(
      `/api/workspaces/${workspaceId}/crm/${resource}/${id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      },
    )
    const json = await response.json()
    if (!response.ok || !json.success) {
      return { ok: false, message: readError(json) }
    }
    return { ok: true, data: json.data as T }
  } catch {
    return { ok: false, message: 'Erro de rede. Tente novamente.' }
  }
}

/** Remove (soft-delete) um registro. */
export async function deleteCrmResource(
  workspaceId: string,
  resource: string,
  id: string,
): Promise<MutationResult<unknown>> {
  try {
    const response = await fetch(
      `/api/workspaces/${workspaceId}/crm/${resource}/${id}`,
      { method: 'DELETE' },
    )
    const json = await response.json()
    if (!response.ok || !json.success) {
      return { ok: false, message: readError(json) }
    }
    return { ok: true }
  } catch {
    return { ok: false, message: 'Erro de rede. Tente novamente.' }
  }
}

/** Persiste a nova ordem (drag-drop) de um recurso. Best-effort. */
export async function reorderCrmResource(
  workspaceId: string,
  resource: string,
  orderedIds: string[],
): Promise<void> {
  try {
    await fetch(`/api/workspaces/${workspaceId}/crm/${resource}/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds }),
    })
  } catch {
    // A ordem local já está aplicada; falha de rede não bloqueia a UI.
  }
}
