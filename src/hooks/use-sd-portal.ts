import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { SdTicketCsatDTO } from '@/types/sd-dashboard'
import { apiFetch } from './_fetch'
import { sdTicketKeys } from './use-sd-tickets'

/**
 * Portal do solicitante. O portal reaproveita os hooks de chamados
 * (`use-sd-tickets`, `use-sd-ticket-messages`); aqui fica só o que é
 * exclusivo dele — hoje, a avaliação do atendimento (CSAT).
 */

export interface SubmitSdTicketCsatInput {
  /** 1 a 5 estrelas. */
  score: number
  comment?: string
}

/**
 * Avalia o atendimento (uma única vez, depois de resolvido/fechado). Ao
 * concluir, invalida o chamado para a tela mostrar a nota registrada.
 */
export function useSubmitSdTicketCsat(workspaceId: string, ticketRef: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SubmitSdTicketCsatInput) =>
      apiFetch<SdTicketCsatDTO>(
        `/api/workspaces/${workspaceId}/servicedesk/tickets/${encodeURIComponent(ticketRef)}/csat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        },
        'Erro ao enviar sua avaliação',
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: sdTicketKeys.all(workspaceId),
      }),
  })
}
