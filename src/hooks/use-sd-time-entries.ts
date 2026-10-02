import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SdTimerActionDTO } from '@/src/schemas/sd-time-entry.schema'
import type { SdTimeEntryDTO, SdTimeEntryListDTO } from '@/types/sd-time-entry'
import { apiFetch, apiSend } from './_fetch'
import { sdJson, sdTicketTabKey, sdTicketTabUrl } from './_sd-ticket-tab'

/**
 * Aba "Horas" do chamado: cronômetro (iniciar/pausar/retomar/parar),
 * lançamento manual e a lista com o total. As chaves ficam sob
 * `['sd-tickets', ws, …]`, então o SSE do chamado recarrega a aba sozinho.
 */

export interface SdTimeEntryInput {
  /** ISO 8601. */
  startedAt: string
  endedAt: string
  billable?: boolean
  description?: string | null
  /** Apontar por outro agente (só admins). */
  userId?: string | null
}

export interface SdTimeEntryPatch {
  startedAt?: string
  endedAt?: string
  billable?: boolean
  description?: string | null
}

export function useSdTimeEntries(workspaceId: string, ticketRef: string) {
  return useQuery({
    queryKey: sdTicketTabKey(workspaceId, ticketRef, 'time-entries'),
    queryFn: () =>
      apiFetch<SdTimeEntryListDTO>(
        sdTicketTabUrl(workspaceId, ticketRef, 'time-entries'),
        undefined,
        'Erro ao carregar os apontamentos',
      ),
    enabled: Boolean(workspaceId && ticketRef),
  })
}

function useInvalidate(workspaceId: string, ticketRef: string) {
  const qc = useQueryClient()
  return () =>
    qc.invalidateQueries({
      queryKey: sdTicketTabKey(workspaceId, ticketRef, 'time-entries'),
    })
}

/** Cronômetro: `start`/`resume` abrem um trecho, `pause`/`stop` fecham. */
export function useSdTimer(workspaceId: string, ticketRef: string) {
  const invalidate = useInvalidate(workspaceId, ticketRef)
  return useMutation({
    mutationFn: (input: {
      action: SdTimerActionDTO['action']
      description?: string | null
    }) =>
      apiFetch<SdTimeEntryDTO>(
        `${sdTicketTabUrl(workspaceId, ticketRef, 'time-entries')}/timer`,
        sdJson('POST', input),
        'Erro ao mexer no cronômetro',
      ),
    onSuccess: invalidate,
  })
}

export function useCreateSdTimeEntry(workspaceId: string, ticketRef: string) {
  const invalidate = useInvalidate(workspaceId, ticketRef)
  return useMutation({
    mutationFn: (input: SdTimeEntryInput) =>
      apiFetch<SdTimeEntryDTO>(
        sdTicketTabUrl(workspaceId, ticketRef, 'time-entries'),
        sdJson('POST', input),
        'Erro ao lançar as horas',
      ),
    onSuccess: invalidate,
  })
}

export function useUpdateSdTimeEntry(workspaceId: string, ticketRef: string) {
  const invalidate = useInvalidate(workspaceId, ticketRef)
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SdTimeEntryPatch }) =>
      apiFetch<SdTimeEntryDTO>(
        `${sdTicketTabUrl(workspaceId, ticketRef, 'time-entries')}/${id}`,
        sdJson('PATCH', data),
        'Erro ao salvar o apontamento',
      ),
    onSuccess: invalidate,
  })
}

export function useDeleteSdTimeEntry(workspaceId: string, ticketRef: string) {
  const invalidate = useInvalidate(workspaceId, ticketRef)
  return useMutation({
    mutationFn: (id: string) =>
      apiSend(
        `${sdTicketTabUrl(workspaceId, ticketRef, 'time-entries')}/${id}`,
        { method: 'DELETE' },
        'Erro ao excluir o apontamento',
      ),
    onSuccess: invalidate,
  })
}
