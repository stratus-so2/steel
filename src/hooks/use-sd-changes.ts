import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SdApprovalRoundDTO } from '@/types/sd-cab'
import type {
  SdChangeCalendarDTO,
  SdTicketChangeScheduleDTO,
} from '@/types/sd-change'
import { apiFetch, apiSend } from './_fetch'
import { sdJson, sdTicketTabKey, sdTicketTabUrl } from './_sd-ticket-tab'

/**
 * Calendário de mudanças e rodadas de aprovação do comitê (CAB).
 *
 * As janelas e os comitês são **configuração**: a aba "Mudanças" das
 * configurações usa os hooks genéricos `useSdConfigList` /
 * `useSdConfigMutations` com os recursos `change-windows` e `cab-boards`
 * (`src/hooks/use-sd-config.ts`).
 */

const base = (workspaceId: string) =>
  `/api/workspaces/${workspaceId}/servicedesk`

export const sdChangeKeys = {
  calendar: (workspaceId: string, from: string, to: string) =>
    ['sd-change-calendar', workspaceId, from, to] as const,
}

/** Calendário do intervalo (ISO). As janelas já vêm expandidas. */
export function useSdChangeCalendar(
  workspaceId: string,
  range: { from: string; to: string },
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: sdChangeKeys.calendar(workspaceId, range.from, range.to),
    queryFn: () =>
      apiFetch<SdChangeCalendarDTO>(
        `${base(workspaceId)}/change-calendar?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
        undefined,
        'Erro ao carregar o calendário de mudanças',
      ),
    enabled: Boolean(workspaceId) && (options.enabled ?? true),
  })
}

/** Agenda da mudança do chamado: janela, janelas que a cobrem e avisos. */
export function useSdTicketChangeSchedule(
  workspaceId: string,
  ticketRef: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: sdTicketTabKey(workspaceId, ticketRef, 'change-schedule'),
    queryFn: () =>
      apiFetch<SdTicketChangeScheduleDTO>(
        sdTicketTabUrl(workspaceId, ticketRef, 'change-schedule'),
        undefined,
        'Erro ao carregar a agenda da mudança',
      ),
    enabled: Boolean(workspaceId && ticketRef) && (options.enabled ?? true),
  })
}

export function useSdApprovalRounds(
  workspaceId: string,
  ticketRef: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: sdTicketTabKey(workspaceId, ticketRef, 'approval-rounds'),
    queryFn: () =>
      apiFetch<SdApprovalRoundDTO[]>(
        sdTicketTabUrl(workspaceId, ticketRef, 'approval-rounds'),
        undefined,
        'Erro ao carregar as rodadas de aprovação',
      ),
    enabled: Boolean(workspaceId && ticketRef) && (options.enabled ?? true),
  })
}

export interface OpenSdApprovalRoundInput {
  boardId?: string
  message?: string | null
  expiresInDays?: number
}

/** Abrir e cancelar a rodada do comitê. */
export function useSdApprovalRoundMutations(
  workspaceId: string,
  ticketRef: string,
) {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({
      queryKey: sdTicketTabKey(workspaceId, ticketRef, 'approval-rounds'),
    })
    qc.invalidateQueries({
      queryKey: sdTicketTabKey(workspaceId, ticketRef, 'approvals'),
    })
  }
  const url = sdTicketTabUrl(workspaceId, ticketRef, 'approval-rounds')

  const open = useMutation({
    mutationFn: (input: OpenSdApprovalRoundInput) =>
      apiFetch<SdApprovalRoundDTO>(
        url,
        sdJson('POST', input),
        'Erro ao abrir a rodada de aprovação',
      ),
    onSuccess: invalidate,
  })
  const cancel = useMutation({
    mutationFn: (roundId: string) =>
      apiSend(
        `${url}/${roundId}`,
        { method: 'DELETE' },
        'Erro ao cancelar a rodada',
      ),
    onSuccess: invalidate,
  })
  return { open, cancel }
}
