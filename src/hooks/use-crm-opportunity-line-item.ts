import { useCallback, useEffect, useState } from 'react'
import type { CrmOpportunityLineItemDTO } from '@/types/crm-opportunity'

type ApiResponse<T> = { success: boolean; data?: T; message?: string }

function baseUrl(workspaceId: string, opportunityId: string): string {
  return `/api/workspaces/${workspaceId}/crm/opportunities/${opportunityId}/line-items`
}

/** Itens de uma oportunidade, com refetch manual. */
export function useCrmOpportunityLineItems(
  workspaceId: string,
  opportunityId: string,
) {
  const [items, setItems] = useState<CrmOpportunityLineItemDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(baseUrl(workspaceId, opportunityId))
      const json = (await res.json()) as ApiResponse<
        CrmOpportunityLineItemDTO[]
      >
      setItems(res.ok && json.success && json.data ? json.data : [])
    } catch {
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [workspaceId, opportunityId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { items, isLoading, refetch }
}

export async function createCrmOpportunityLineItem(
  workspaceId: string,
  opportunityId: string,
  input: {
    productId?: string
    name?: string
    quantity: number
    unitPrice?: number
    discountPct?: number
  },
): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(baseUrl(workspaceId, opportunityId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Novo item', ...input }),
  })
  const json = (await res.json()) as ApiResponse<CrmOpportunityLineItemDTO>
  return { ok: res.ok && json.success, message: json.message }
}

export async function updateCrmOpportunityLineItem(
  workspaceId: string,
  opportunityId: string,
  id: string,
  patch: Partial<
    Pick<
      CrmOpportunityLineItemDTO,
      'name' | 'quantity' | 'unitPrice' | 'discountPct'
    >
  >,
): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`${baseUrl(workspaceId, opportunityId)}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  const json = (await res.json()) as ApiResponse<CrmOpportunityLineItemDTO>
  return { ok: res.ok && json.success, message: json.message }
}

export async function deleteCrmOpportunityLineItem(
  workspaceId: string,
  opportunityId: string,
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`${baseUrl(workspaceId, opportunityId)}/${id}`, {
    method: 'DELETE',
  })
  const json = (await res.json().catch(() => ({}))) as ApiResponse<unknown>
  return { ok: res.ok, message: json.message }
}
