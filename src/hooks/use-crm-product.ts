import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CrmBillingTypeDTO, CrmProductDTO } from '@/types/crm-product'
import { apiFetch, apiSend } from './_fetch'

function productsKey(workspaceId: string) {
  return ['crm-products', workspaceId] as const
}

export function useCrmProducts(workspaceId: string) {
  return useQuery({
    queryKey: productsKey(workspaceId),
    queryFn: () =>
      apiFetch<CrmProductDTO[]>(
        `/api/workspaces/${workspaceId}/crm/products`,
        undefined,
        'Erro ao buscar produtos',
      ),
    enabled: !!workspaceId,
    staleTime: 2 * 60 * 1000,
  })
}

export function useCreateCrmProduct(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      name: string
      unitPrice?: number
      billingType?: CrmBillingTypeDTO
    }) =>
      apiFetch<CrmProductDTO>(
        `/api/workspaces/${workspaceId}/crm/products`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao criar produto',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productsKey(workspaceId) })
    },
  })
}

export function useDeleteCrmProduct(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (productId: string) =>
      apiSend(
        `/api/workspaces/${workspaceId}/crm/products/${productId}`,
        { method: 'DELETE' },
        'Erro ao remover produto',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productsKey(workspaceId) })
    },
  })
}
