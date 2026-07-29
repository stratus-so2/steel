'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AdminWorkspaceSummaryDTO } from '@/types/admin-workspace'
import type { WorkspaceModuleAccessSummaryDTO } from '@/types/workspace-module-access'

type ApiResponse<T> = { success: boolean; data?: T; message?: string }

/** Lista todos os workspaces da plataforma, para o painel admin global. */
export function useAdminWorkspaces() {
  const [workspaces, setWorkspaces] = useState<AdminWorkspaceSummaryDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const res = await fetch('/api/admin/workspaces')
        const json: ApiResponse<AdminWorkspaceSummaryDTO[]> = await res.json()
        if (cancelled) return
        if (!res.ok || !json.success || !json.data) {
          setError(json?.message ?? 'Não foi possível carregar os workspaces.')
          return
        }
        setWorkspaces(json.data)
      } catch {
        if (!cancelled) setError('Erro de rede. Tente novamente.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return { workspaces, isLoading, error }
}

/** Matriz de acesso a módulos de um workspace, com toggle. */
export function useAdminModuleAccess(workspaceId: string) {
  const [access, setAccess] = useState<WorkspaceModuleAccessSummaryDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!workspaceId) return
    setIsLoading(true)
    try {
      const res = await fetch(
        `/api/admin/workspaces/${workspaceId}/module-access`,
      )
      const json: ApiResponse<WorkspaceModuleAccessSummaryDTO[]> =
        await res.json()
      if (json.success && json.data) setAccess(json.data)
    } finally {
      setIsLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function setEnabled(module: string, enabled: boolean) {
    const res = await fetch(
      `/api/admin/workspaces/${workspaceId}/module-access`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module, enabled }),
      },
    )
    const json = await res.json()
    if (!res.ok || !json.success) {
      return {
        ok: false as const,
        message: json?.message as string | undefined,
      }
    }
    await refetch()
    return { ok: true as const }
  }

  return { access, isLoading, setEnabled }
}
