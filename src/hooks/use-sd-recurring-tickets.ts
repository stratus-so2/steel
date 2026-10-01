import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CreateSdRecurringTicketDTO,
  ListSdRecurringTicketsDTO,
  UpdateSdRecurringTicketDTO,
} from '@/src/schemas/sd-recurring-ticket.schema'
import type {
  SdRecurringTicketDTO,
  SdRecurringTicketRunDTO,
} from '@/types/sd-recurring-ticket'
import { apiFetch, apiSend } from './_fetch'

/**
 * Chamados recorrentes (manutenção preventiva): a aba "Recorrentes" das
 * configurações e o bloco de rotinas na tela do item de configuração.
 * Leitura de qualquer agente; as mutações exigem admin do módulo.
 */

const base = (workspaceId: string) =>
  `/api/workspaces/${workspaceId}/servicedesk/recurring-tickets`

type Filters = Omit<ListSdRecurringTicketsDTO, 'includeInactive'> & {
  includeInactive?: boolean
}

function withQuery(url: string, filters: Filters = {}): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `${url}?${qs}` : url
}

function json(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }
}

export const sdRecurringKeys = {
  all: (ws: string) => ['sd-recurring', ws] as const,
  list: (ws: string, filters: Filters = {}) =>
    ['sd-recurring', ws, 'list', filters] as const,
  runs: (ws: string, id: string) => ['sd-recurring', ws, 'runs', id] as const,
}

export function useSdRecurringTickets(
  workspaceId: string,
  filters: Filters = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: sdRecurringKeys.list(workspaceId, filters),
    queryFn: () =>
      apiFetch<SdRecurringTicketDTO[]>(
        withQuery(base(workspaceId), filters),
        undefined,
        'Erro ao carregar as rotinas recorrentes',
      ),
    enabled: Boolean(workspaceId) && options.enabled !== false,
  })
}

/** Histórico de ocorrências de uma rotina. */
export function useSdRecurringRuns(
  workspaceId: string,
  recurringId: string | null,
) {
  return useQuery({
    queryKey: sdRecurringKeys.runs(workspaceId, recurringId ?? ''),
    queryFn: () =>
      apiFetch<SdRecurringTicketRunDTO[]>(
        `${base(workspaceId)}/${recurringId}/runs`,
        undefined,
        'Erro ao carregar o histórico da rotina',
      ),
    enabled: Boolean(workspaceId && recurringId),
  })
}

function useInvalidateRecurring(workspaceId: string) {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({
      queryKey: sdRecurringKeys.all(workspaceId),
    })
}

export function useCreateSdRecurringTicket(workspaceId: string) {
  const invalidate = useInvalidateRecurring(workspaceId)
  return useMutation({
    mutationFn: (input: CreateSdRecurringTicketDTO) =>
      apiFetch<SdRecurringTicketDTO>(
        base(workspaceId),
        json('POST', input),
        'Erro ao criar a rotina',
      ),
    onSuccess: invalidate,
  })
}

export function useUpdateSdRecurringTicket(workspaceId: string) {
  const invalidate = useInvalidateRecurring(workspaceId)
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: UpdateSdRecurringTicketDTO
    }) =>
      apiFetch<SdRecurringTicketDTO>(
        `${base(workspaceId)}/${id}`,
        json('PATCH', data),
        'Erro ao salvar a rotina',
      ),
    onSuccess: invalidate,
  })
}

export function useDeleteSdRecurringTicket(workspaceId: string) {
  const invalidate = useInvalidateRecurring(workspaceId)
  return useMutation({
    mutationFn: (id: string) =>
      apiSend(
        `${base(workspaceId)}/${id}`,
        { method: 'DELETE' },
        'Erro ao excluir a rotina',
      ),
    onSuccess: invalidate,
  })
}

/** "Gerar agora": abre o chamado na hora, para testar a configuração. */
export function useRunSdRecurringTicketNow(workspaceId: string) {
  const invalidate = useInvalidateRecurring(workspaceId)
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<SdRecurringTicketRunDTO>(
        `${base(workspaceId)}/${id}/run-now`,
        json('POST'),
        'Erro ao gerar o chamado agora',
      ),
    onSuccess: invalidate,
  })
}
