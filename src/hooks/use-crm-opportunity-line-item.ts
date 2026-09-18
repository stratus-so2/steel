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

type MutationResult = { ok: boolean; message?: string }

/**
 * Executa a mutação sem nunca lançar: falha de rede ou resposta não-JSON
 * viram `{ ok: false }`, para a UI liberar os botões e avisar o usuário.
 */
async function send(url: string, init: RequestInit): Promise<MutationResult> {
  try {
    const res = await fetch(url, init)
    const json = (await res.json().catch(() => ({}))) as ApiResponse<unknown>
    const ok = init.method === 'DELETE' ? res.ok : res.ok && json.success
    return { ok, message: json.message }
  } catch {
    return {
      ok: false,
      message: 'Falha de conexão. Verifique sua internet e tente novamente.',
    }
  }
}

export function createCrmOpportunityLineItem(
  workspaceId: string,
  opportunityId: string,
  input: {
    productId?: string
    name?: string
    quantity: number
    unitPrice?: number
    discountPct?: number
  },
): Promise<MutationResult> {
  return send(baseUrl(workspaceId, opportunityId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Novo item', ...input }),
  })
}

export type CrmOpportunityLineItemPatch = Partial<
  Pick<
    CrmOpportunityLineItemDTO,
    'name' | 'quantity' | 'unitPrice' | 'discountPct'
  >
> & {
  /** string vincula ao produto (a API copia nome/preço); null desvincula. */
  productId?: string | null
}

export function updateCrmOpportunityLineItem(
  workspaceId: string,
  opportunityId: string,
  id: string,
  patch: CrmOpportunityLineItemPatch,
): Promise<MutationResult> {
  return send(`${baseUrl(workspaceId, opportunityId)}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
}

export function deleteCrmOpportunityLineItem(
  workspaceId: string,
  opportunityId: string,
  id: string,
): Promise<MutationResult> {
  return send(`${baseUrl(workspaceId, opportunityId)}/${id}`, {
    method: 'DELETE',
  })
}
