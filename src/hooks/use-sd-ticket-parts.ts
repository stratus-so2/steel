import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  SdPartStatusDTO,
  SdTicketPartDTO,
  SdTicketPartListDTO,
} from '@/types/sd-ticket-part'
import { apiFetch, apiSend } from './_fetch'
import { sdJson, sdTicketTabKey, sdTicketTabUrl } from './_sd-ticket-tab'

export interface SdTicketPartInput {
  /** Peça do catálogo (só na criação). */
  partId?: string | null
  name?: string
  sku?: string | null
  quantity?: number
  /** Decimal como string. Omitido na criação = custo do catálogo. */
  unitCost?: string
  serialNumber?: string | null
  notes?: string | null
  status?: SdPartStatusDTO
}

export function useSdTicketParts(workspaceId: string, ticketRef: string) {
  return useQuery({
    queryKey: sdTicketTabKey(workspaceId, ticketRef, 'parts'),
    queryFn: () =>
      apiFetch<SdTicketPartListDTO>(
        sdTicketTabUrl(workspaceId, ticketRef, 'parts'),
        undefined,
        'Erro ao carregar as peças',
      ),
    enabled: Boolean(workspaceId && ticketRef),
  })
}

function useInvalidate(workspaceId: string, ticketRef: string) {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({
        queryKey: sdTicketTabKey(workspaceId, ticketRef, 'parts'),
      }),
      // Estoque do catálogo muda ao instalar/devolver.
      qc.invalidateQueries({ queryKey: ['sd-config', workspaceId, 'parts'] }),
    ])
}

export function useCreateSdTicketPart(workspaceId: string, ticketRef: string) {
  const invalidate = useInvalidate(workspaceId, ticketRef)
  return useMutation({
    mutationFn: (input: SdTicketPartInput) =>
      apiFetch<SdTicketPartDTO>(
        sdTicketTabUrl(workspaceId, ticketRef, 'parts'),
        sdJson('POST', input),
        'Erro ao adicionar a peça',
      ),
    onSuccess: invalidate,
  })
}

export function useUpdateSdTicketPart(workspaceId: string, ticketRef: string) {
  const invalidate = useInvalidate(workspaceId, ticketRef)
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Omit<SdTicketPartInput, 'partId'>
    }) =>
      apiFetch<SdTicketPartDTO>(
        `${sdTicketTabUrl(workspaceId, ticketRef, 'parts')}/${id}`,
        sdJson('PATCH', data),
        'Erro ao salvar a peça',
      ),
    onSuccess: invalidate,
  })
}

export function useDeleteSdTicketPart(workspaceId: string, ticketRef: string) {
  const invalidate = useInvalidate(workspaceId, ticketRef)
  return useMutation({
    mutationFn: (id: string) =>
      apiSend(
        `${sdTicketTabUrl(workspaceId, ticketRef, 'parts')}/${id}`,
        { method: 'DELETE' },
        'Erro ao remover a peça',
      ),
    onSuccess: invalidate,
  })
}
