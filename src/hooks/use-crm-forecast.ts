'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ForecastDTO } from '@/src/schemas/crm-forecast.schema'
import type { CrmQuotaDTO } from '@/types/crm-quota'

type ApiResponse<T> = { success: boolean; data?: T; message?: string }
type Period = 'MONTH' | 'QUARTER'

/** Previsão de receita do workspace, com refetch manual. */
export function useCrmForecast(workspaceId: string, period: Period) {
  const [data, setData] = useState<ForecastDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/crm/forecast?period=${period}`,
      )
      const json = (await res.json()) as ApiResponse<ForecastDTO>
      setData(res.ok && json.success && json.data ? json.data : null)
    } catch {
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [workspaceId, period])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, isLoading, refetch }
}

/**
 * Define (cria ou atualiza) a meta de um responsável num período. O backend
 * não faz upsert — em conflito (meta já existe para esse
 * responsável/período), busca a meta existente e atualiza pelo id.
 */
export async function setCrmQuota(
  workspaceId: string,
  input: {
    ownerId: string
    period: Period
    periodKey: string
    targetAmount: number
  },
): Promise<{ ok: boolean; message?: string }> {
  const base = `/api/workspaces/${workspaceId}/crm/quotas`
  const created = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const createdJson = (await created.json()) as ApiResponse<CrmQuotaDTO>
  if (created.ok && createdJson.success) return { ok: true }

  if (created.status !== 409) {
    return { ok: false, message: createdJson.message }
  }

  const list = await fetch(
    `${base}?ownerId=${input.ownerId}&period=${input.period}`,
  )
  const listJson = (await list.json()) as ApiResponse<CrmQuotaDTO[]>
  const existing = listJson.data?.find((q) => q.periodKey === input.periodKey)
  if (!existing) {
    return { ok: false, message: 'Meta em conflito não encontrada.' }
  }

  const updated = await fetch(`${base}/${existing.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetAmount: input.targetAmount }),
  })
  const updatedJson = (await updated.json()) as ApiResponse<CrmQuotaDTO>
  return {
    ok: updated.ok && updatedJson.success,
    message: updatedJson.message,
  }
}
