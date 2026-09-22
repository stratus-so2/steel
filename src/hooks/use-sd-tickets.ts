import {
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import type {
  SdBulkUpdateResultDTO,
  SdPhaseCategoryDTO,
  SdSavedViewDTO,
  SdTicketChannelDTO,
  SdTicketDTO,
  SdTicketEscalationDTO,
  SdTicketEventPageDTO,
  SdTicketKanbanDTO,
  SdTicketPageDTO,
  SdTicketSummaryDTO,
  SdTicketTypeDTO,
  SdUserSummaryDTO,
} from '@/types/sd-ticket'
import { apiFetch, apiSend } from './_fetch'

/* ------------------------------------------------------------------ */
/* Tipos de entrada                                                     */
/* ------------------------------------------------------------------ */

/** Filtros de `GET .../servicedesk/tickets` (mesmo formato das visões salvas). */
export interface SdTicketFilters {
  type?: SdTicketTypeDTO
  types?: SdTicketTypeDTO[]
  phaseIds?: string[]
  phaseCategories?: SdPhaseCategoryDTO[]
  priorityIds?: string[]
  severityIds?: string[]
  impactIds?: string[]
  urgencyIds?: string[]
  departmentIds?: string[]
  /** Ids, `me` e/ou `unassigned`. */
  assigneeIds?: string[]
  /** Id ou `me`. */
  requesterId?: string
  /** Participante: id ou `me`. */
  participantId?: string
  customerId?: string
  companyId?: string
  contactId?: string
  configItemId?: string
  categoryId?: string
  subcategoryId?: string
  serviceId?: string
  classificationId?: string
  channel?: SdTicketChannelDTO
  tags?: string[]
  sla?: 'at_risk' | 'breached'
  createdFrom?: string
  createdTo?: string
  dueFrom?: string
  dueTo?: string
  /** Id do pai ou `none`. */
  parentId?: string
  q?: string
  includeClosed?: boolean
  sort?:
    | 'createdAt'
    | 'updatedAt'
    | 'lastActivityAt'
    | 'number'
    | 'title'
    | 'priority'
    | 'resolutionDueAt'
    | 'firstResponseDueAt'
  order?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  cursor?: string
  /** Kanban: itens por coluna. */
  columnLimit?: number
}

type Nullable<T> = { [K in keyof T]?: T[K] | null }

export interface SdTicketEditableInput
  extends Nullable<{
    impactId: string
    urgencyId: string
    priorityId: string
    severityId: string
    categoryId: string
    subcategoryId: string
    serviceId: string
    classificationId: string
    customerId: string
    companyId: string
    contactId: string
    configItemId: string
    departmentId: string
    assigneeId: string
    requesterId: string
    parentId: string
    changeType: 'STANDARD' | 'NORMAL' | 'EMERGENCY'
    changeRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'
    plannedStartAt: string
    plannedEndAt: string
    implementationPlan: string
    rollbackPlan: string
    testPlan: string
    rootCause: string
    workaround: string
  }> {
  tags?: string[]
  customFields?: Record<string, unknown>
  knownError?: boolean
}

export interface CreateSdTicketInput extends SdTicketEditableInput {
  type: SdTicketTypeDTO
  title: string
  /** HTML do editor rico (sanitizado no servidor). */
  description?: string
  channel?: SdTicketChannelDTO
  templateId?: string
  phaseId?: string
}

export interface UpdateSdTicketInput extends SdTicketEditableInput {
  title?: string
  description?: string | null
  channel?: SdTicketChannelDTO
  solution?: string | null
  solutionClassificationId?: string | null
  csatScore?: number | null
  csatComment?: string | null
}

export interface MoveSdTicketPhaseInput {
  ticketRef: string
  phaseId: string
  solution?: string
  solutionClassificationId?: string
  comment?: string
}

export interface BulkUpdateSdTicketsInput {
  ids: string[]
  assigneeId?: string | null
  departmentId?: string | null
  priorityId?: string | null
  phaseId?: string
}

export interface EscalateSdTicketInput {
  kind: 'FUNCTIONAL' | 'HIERARCHICAL'
  toDepartmentId?: string
  toUserId?: string
  reason: string
}

export interface SdSavedViewInput {
  name: string
  ticketType?: SdTicketTypeDTO | null
  mode?: 'KANBAN' | 'LIST' | 'TABLE'
  filters?: Record<string, unknown>
  sort?: { field: string; order: 'asc' | 'desc' }[]
  columns?: string[]
  shared?: boolean
  position?: number
}

/** Evento do SSE (`src/lib/servicedesk/realtime.ts`). */
export interface SdTicketRealtimeEvent {
  type:
    | 'ticket.created'
    | 'ticket.updated'
    | 'ticket.phase_changed'
    | 'ticket.assigned'
    | 'ticket.deleted'
    | 'ticket.escalated'
    | 'ticket.sla'
    | 'ticket.participants'
    | 'ticket.message'
    | 'ticket.task'
    | 'ticket.cost'
    | 'ticket.part'
    | 'ticket.attachment'
    | 'ticket.approval'
    | 'ticket.signature'
  ticketId: string
  number: number
  at: string
  actorId?: string | null
  internal?: boolean
}

/* ------------------------------------------------------------------ */
/* Chaves e helpers                                                     */
/* ------------------------------------------------------------------ */

export const sdTicketKeys = {
  all: (ws: string) => ['sd-tickets', ws] as const,
  list: (ws: string, filters: SdTicketFilters) =>
    ['sd-tickets', ws, 'list', filters] as const,
  infinite: (ws: string, filters: SdTicketFilters) =>
    ['sd-tickets', ws, 'infinite', filters] as const,
  kanban: (ws: string, filters: SdTicketFilters) =>
    ['sd-tickets', ws, 'kanban', filters] as const,
  summary: (ws: string) => ['sd-tickets', ws, 'summary'] as const,
  detail: (ws: string, ref: string) =>
    ['sd-tickets', ws, 'detail', ref] as const,
  participants: (ws: string, ref: string) =>
    ['sd-tickets', ws, 'participants', ref] as const,
  events: (ws: string, ref: string) =>
    ['sd-tickets', ws, 'events', ref] as const,
  escalations: (ws: string, ref: string) =>
    ['sd-tickets', ws, 'escalations', ref] as const,
  savedViews: (ws: string) => ['sd-saved-views', ws] as const,
}

const base = (ws: string) => `/api/workspaces/${ws}/servicedesk`
const ticketUrl = (ws: string, ref: string) =>
  `${base(ws)}/tickets/${encodeURIComponent(ref)}`

const JSON_HEADERS = { 'Content-Type': 'application/json' }

function send(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: JSON_HEADERS,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }
}

/** Query string no formato aceito pela API (listas em CSV). */
export function sdTicketQueryString(
  filters: SdTicketFilters & { view?: 'list' | 'kanban' },
): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(','))
    } else {
      params.set(key, String(value))
    }
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

function invalidateTickets(qc: QueryClient, ws: string) {
  return qc.invalidateQueries({ queryKey: sdTicketKeys.all(ws) })
}

/* ------------------------------------------------------------------ */
/* Leitura                                                              */
/* ------------------------------------------------------------------ */

/** Lista paginada (página). */
export function useSdTickets(
  workspaceId: string,
  filters: SdTicketFilters = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: sdTicketKeys.list(workspaceId, filters),
    queryFn: () =>
      apiFetch<SdTicketPageDTO>(
        `${base(workspaceId)}/tickets${sdTicketQueryString(filters)}`,
        undefined,
        'Erro ao buscar chamados',
      ),
    enabled: Boolean(workspaceId) && options.enabled !== false,
    staleTime: 15 * 1000,
  })
}

/** Lista com rolagem infinita (cursor). */
export function useInfiniteSdTickets(
  workspaceId: string,
  filters: Omit<SdTicketFilters, 'cursor' | 'page'> = {},
) {
  return useInfiniteQuery({
    queryKey: sdTicketKeys.infinite(workspaceId, filters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiFetch<SdTicketPageDTO>(
        `${base(workspaceId)}/tickets${sdTicketQueryString({ ...filters, cursor: pageParam })}`,
        undefined,
        'Erro ao buscar chamados',
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(workspaceId),
    staleTime: 15 * 1000,
  })
}

/** Quadro kanban de um tipo (`filters.type` obrigatório). */
export function useSdTicketKanban(
  workspaceId: string,
  filters: SdTicketFilters & { type: SdTicketTypeDTO },
) {
  return useQuery({
    queryKey: sdTicketKeys.kanban(workspaceId, filters),
    queryFn: () =>
      apiFetch<SdTicketKanbanDTO>(
        `${base(workspaceId)}/tickets${sdTicketQueryString({ ...filters, view: 'kanban' })}`,
        undefined,
        'Erro ao carregar o quadro',
      ),
    enabled: Boolean(workspaceId && filters.type),
    staleTime: 15 * 1000,
  })
}

export function useSdTicketSummary(workspaceId: string) {
  return useQuery({
    queryKey: sdTicketKeys.summary(workspaceId),
    queryFn: () =>
      apiFetch<SdTicketSummaryDTO>(
        `${base(workspaceId)}/tickets/summary`,
        undefined,
        'Erro ao carregar o resumo',
      ),
    enabled: Boolean(workspaceId),
    staleTime: 30 * 1000,
  })
}

/** Chamado por id, número ou código (`INC-000123`). */
export function useSdTicket(
  workspaceId: string,
  ticketRef: string | undefined,
) {
  return useQuery({
    queryKey: sdTicketKeys.detail(workspaceId, ticketRef ?? ''),
    queryFn: () =>
      apiFetch<SdTicketDTO>(
        ticketUrl(workspaceId, ticketRef as string),
        undefined,
        'Erro ao carregar o chamado',
      ),
    enabled: Boolean(workspaceId && ticketRef),
  })
}

export function useSdTicketParticipants(
  workspaceId: string,
  ticketRef: string,
) {
  return useQuery({
    queryKey: sdTicketKeys.participants(workspaceId, ticketRef),
    queryFn: () =>
      apiFetch<SdUserSummaryDTO[]>(
        `${ticketUrl(workspaceId, ticketRef)}/participants`,
        undefined,
        'Erro ao buscar participantes',
      ),
    enabled: Boolean(workspaceId && ticketRef),
  })
}

/** Rastreabilidade (cursor, mais recentes primeiro). */
export function useSdTicketEvents(
  workspaceId: string,
  ticketRef: string,
  limit = 50,
) {
  return useInfiniteQuery({
    queryKey: sdTicketKeys.events(workspaceId, ticketRef),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiFetch<SdTicketEventPageDTO>(
        `${ticketUrl(workspaceId, ticketRef)}/events?limit=${limit}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`,
        undefined,
        'Erro ao carregar a rastreabilidade',
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(workspaceId && ticketRef),
  })
}

export function useSdTicketEscalations(workspaceId: string, ticketRef: string) {
  return useQuery({
    queryKey: sdTicketKeys.escalations(workspaceId, ticketRef),
    queryFn: () =>
      apiFetch<SdTicketEscalationDTO[]>(
        `${ticketUrl(workspaceId, ticketRef)}/escalations`,
        undefined,
        'Erro ao carregar os escalonamentos',
      ),
    enabled: Boolean(workspaceId && ticketRef),
  })
}

/* ------------------------------------------------------------------ */
/* Mutações                                                             */
/* ------------------------------------------------------------------ */

export function useCreateSdTicket(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSdTicketInput) =>
      apiFetch<SdTicketDTO>(
        `${base(workspaceId)}/tickets`,
        send('POST', input),
        'Erro ao abrir o chamado',
      ),
    onSuccess: () => invalidateTickets(qc, workspaceId),
  })
}

export function useUpdateSdTicket(workspaceId: string, ticketRef: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateSdTicketInput) =>
      apiFetch<SdTicketDTO>(
        ticketUrl(workspaceId, ticketRef),
        send('PATCH', input),
        'Erro ao salvar o chamado',
      ),
    onSuccess: (ticket) => {
      qc.setQueryData(sdTicketKeys.detail(workspaceId, ticketRef), ticket)
      return invalidateTickets(qc, workspaceId)
    },
  })
}

type KanbanSnapshot = [readonly unknown[], SdTicketKanbanDTO | undefined][]

/**
 * Move de fase. Otimista no quadro: o cartão muda de coluna na hora e
 * volta se a API recusar (transição, campos obrigatórios, aprovação…).
 */
export function useMoveSdTicketPhase(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ticketRef, ...body }: MoveSdTicketPhaseInput) =>
      apiFetch<SdTicketDTO>(
        `${ticketUrl(workspaceId, ticketRef)}/phase`,
        send('POST', body),
        'Não foi possível mover o chamado',
      ),
    onMutate: async ({ ticketRef, phaseId }) => {
      const prefix = ['sd-tickets', workspaceId, 'kanban']
      await qc.cancelQueries({ queryKey: prefix })
      const snapshot: KanbanSnapshot = qc.getQueriesData<SdTicketKanbanDTO>({
        queryKey: prefix,
      })
      for (const [key, board] of snapshot) {
        if (!board) continue
        const card = board.columns
          .flatMap((c) => c.items)
          .find(
            (t) =>
              t.id === ticketRef ||
              String(t.number) === ticketRef ||
              t.code === ticketRef,
          )
        if (!card || card.phaseId === phaseId) continue
        qc.setQueryData<SdTicketKanbanDTO>(key, {
          ...board,
          columns: board.columns.map((column) => {
            if (column.phase.id === card.phaseId) {
              return {
                ...column,
                count: Math.max(0, column.count - 1),
                items: column.items.filter((t) => t.id !== card.id),
              }
            }
            if (column.phase.id === phaseId) {
              return {
                ...column,
                count: column.count + 1,
                items: [
                  { ...card, phaseId, phase: column.phase },
                  ...column.items,
                ],
              }
            }
            return column
          }),
        })
      }
      return { snapshot }
    },
    onError: (_error, _input, context) => {
      for (const [key, board] of context?.snapshot ?? []) {
        qc.setQueryData(key, board)
      }
    },
    onSettled: () => invalidateTickets(qc, workspaceId),
  })
}

export function useBulkUpdateSdTickets(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: BulkUpdateSdTicketsInput) =>
      apiFetch<SdBulkUpdateResultDTO>(
        `${base(workspaceId)}/tickets/bulk`,
        send('POST', input),
        'Erro ao atualizar os chamados',
      ),
    onSettled: () => invalidateTickets(qc, workspaceId),
  })
}

export function useSetSdTicketParent(workspaceId: string, ticketRef: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (parentId: string | null) =>
      apiFetch<SdTicketDTO>(
        `${ticketUrl(workspaceId, ticketRef)}/parent`,
        send('PATCH', { parentId }),
        'Erro ao definir o item pai',
      ),
    onSuccess: () => invalidateTickets(qc, workspaceId),
  })
}

export function useDeleteSdTicket(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ticketRef: string) =>
      apiSend(
        ticketUrl(workspaceId, ticketRef),
        send('DELETE'),
        'Erro ao excluir o chamado',
      ),
    onSuccess: () => invalidateTickets(qc, workspaceId),
  })
}

export function useAddSdTicketParticipant(
  workspaceId: string,
  ticketRef: string,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<SdUserSummaryDTO[]>(
        `${ticketUrl(workspaceId, ticketRef)}/participants`,
        send('POST', { userId }),
        'Erro ao adicionar participante',
      ),
    onSuccess: () => invalidateTickets(qc, workspaceId),
  })
}

export function useRemoveSdTicketParticipant(
  workspaceId: string,
  ticketRef: string,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<SdUserSummaryDTO[]>(
        `${ticketUrl(workspaceId, ticketRef)}/participants/${encodeURIComponent(userId)}`,
        send('DELETE'),
        'Erro ao remover participante',
      ),
    onSuccess: () => invalidateTickets(qc, workspaceId),
  })
}

export function useEscalateSdTicket(workspaceId: string, ticketRef: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: EscalateSdTicketInput) =>
      apiFetch<{ ticket: SdTicketDTO; escalation: SdTicketEscalationDTO }>(
        `${ticketUrl(workspaceId, ticketRef)}/escalations`,
        send('POST', input),
        'Erro ao escalonar o chamado',
      ),
    onSuccess: () => invalidateTickets(qc, workspaceId),
  })
}

/* ------------------------------------------------------------------ */
/* Visões salvas                                                        */
/* ------------------------------------------------------------------ */

export function useSdSavedViews(workspaceId: string) {
  return useQuery({
    queryKey: sdTicketKeys.savedViews(workspaceId),
    queryFn: () =>
      apiFetch<SdSavedViewDTO[]>(
        `${base(workspaceId)}/saved-views`,
        undefined,
        'Erro ao buscar as visões salvas',
      ),
    enabled: Boolean(workspaceId),
    staleTime: 60 * 1000,
  })
}

export function useCreateSdSavedView(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SdSavedViewInput) =>
      apiFetch<SdSavedViewDTO>(
        `${base(workspaceId)}/saved-views`,
        send('POST', input),
        'Erro ao salvar a visão',
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: sdTicketKeys.savedViews(workspaceId) }),
  })
}

export function useUpdateSdSavedView(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: Partial<SdSavedViewInput> & { id: string }) =>
      apiFetch<SdSavedViewDTO>(
        `${base(workspaceId)}/saved-views/${id}`,
        send('PATCH', input),
        'Erro ao atualizar a visão',
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: sdTicketKeys.savedViews(workspaceId) }),
  })
}

export function useDeleteSdSavedView(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiSend(
        `${base(workspaceId)}/saved-views/${id}`,
        send('DELETE'),
        'Erro ao excluir a visão',
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: sdTicketKeys.savedViews(workspaceId) }),
  })
}

/* ------------------------------------------------------------------ */
/* Tempo real                                                           */
/* ------------------------------------------------------------------ */

/**
 * Assina o SSE do ServiceDesk e invalida as queries de chamados do
 * workspace a cada evento. `onEvent` recebe o evento bruto (ex.: as abas do
 * chamado invalidam mensagens/tarefas em `ticket.message`/`ticket.task`).
 */
export function useSdTicketRealtime(
  workspaceId: string | undefined,
  onEvent?: (event: SdTicketRealtimeEvent) => void,
) {
  const qc = useQueryClient()
  const handler = useRef(onEvent)
  handler.current = onEvent

  useEffect(() => {
    if (!workspaceId) return
    const source = new EventSource(`${base(workspaceId)}/events`)
    source.onmessage = (message) => {
      let event: SdTicketRealtimeEvent
      try {
        event = JSON.parse(message.data)
      } catch {
        return
      }
      qc.invalidateQueries({ queryKey: sdTicketKeys.all(workspaceId) })
      handler.current?.(event)
    }
    return () => source.close()
  }, [workspaceId, qc])
}
