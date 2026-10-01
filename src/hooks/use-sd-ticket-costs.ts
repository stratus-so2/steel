import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  SdCostCategoryDTO,
  SdTicketCostDTO,
  SdTicketCostListDTO,
} from '@/types/sd-ticket-cost'
import { apiFetch, apiSend } from './_fetch'
import { sdJson, sdTicketTabKey, sdTicketTabUrl } from './_sd-ticket-tab'

export interface SdTicketCostInput {
  category?: SdCostCategoryDTO
  description?: string
  /** Decimal como string (`"1,5"` ou `"1.50"`). */
  quantity?: string
  unitCost?: string
  billable?: boolean
  /** ISO 8601. */
  incurredAt?: string
  userId?: string | null
}

export function useSdTicketCosts(workspaceId: string, ticketRef: string) {
  return useQuery({
    queryKey: sdTicketTabKey(workspaceId, ticketRef, 'costs'),
    queryFn: () =>
      apiFetch<SdTicketCostListDTO>(
        sdTicketTabUrl(workspaceId, ticketRef, 'costs'),
        undefined,
        'Erro ao carregar os custos',
      ),
    enabled: Boolean(workspaceId && ticketRef),
  })
}

function useInvalidate(workspaceId: string, ticketRef: string) {
  const qc = useQueryClient()
  return () =>
    qc.invalidateQueries({
      queryKey: sdTicketTabKey(workspaceId, ticketRef, 'costs'),
    })
}

export function useCreateSdTicketCost(workspaceId: string, ticketRef: string) {
  const invalidate = useInvalidate(workspaceId, ticketRef)
  return useMutation({
    mutationFn: (
      input: SdTicketCostInput & { description: string; unitCost: string },
    ) =>
      apiFetch<SdTicketCostDTO>(
        sdTicketTabUrl(workspaceId, ticketRef, 'costs'),
        sdJson('POST', input),
        'Erro ao lançar o custo',
      ),
    onSuccess: invalidate,
  })
}

export function useUpdateSdTicketCost(workspaceId: string, ticketRef: string) {
  const invalidate = useInvalidate(workspaceId, ticketRef)
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SdTicketCostInput }) =>
      apiFetch<SdTicketCostDTO>(
        `${sdTicketTabUrl(workspaceId, ticketRef, 'costs')}/${id}`,
        sdJson('PATCH', data),
        'Erro ao salvar o custo',
      ),
    onSuccess: invalidate,
  })
}

export function useDeleteSdTicketCost(workspaceId: string, ticketRef: string) {
  const invalidate = useInvalidate(workspaceId, ticketRef)
  return useMutation({
    mutationFn: (id: string) =>
      apiSend(
        `${sdTicketTabUrl(workspaceId, ticketRef, 'costs')}/${id}`,
        { method: 'DELETE' },
        'Erro ao excluir o custo',
      ),
    onSuccess: invalidate,
  })
}
