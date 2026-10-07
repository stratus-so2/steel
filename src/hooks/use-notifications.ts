import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import {
  type NotificationModule,
  type NotificationQuickFilter,
  notificationConversationRef,
  notificationTicketRef,
} from '@/src/lib/notification-kind'
import type { NotificationSnoozePreset } from '@/src/lib/notifications/snooze'
import type {
  NotificationAction,
  NotificationFolder,
} from '@/src/schemas/notification.schema'
import type {
  InboxAiPendingListDTO,
  NotificationActionResultDTO,
  NotificationDeliveryDTO,
  NotificationListDTO,
  NotificationSnoozeResultDTO,
} from '@/types/notification'
import type { AiPendingActionDTO } from '@/types/steel-ai'
import { apiFetch } from './_fetch'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

const NOTIFICATIONS_KEY = (workspaceId: string) =>
  ['notifications', workspaceId] as const

export interface NotificationInboxFilters {
  folder: NotificationFolder
  module?: NotificationModule
  kind?: string
  quick?: NotificationQuickFilter
  search?: string
}

const INBOX_KEY = (workspaceId: string, filters: NotificationInboxFilters) =>
  [
    'notifications',
    workspaceId,
    'inbox',
    filters.folder,
    filters.module ?? null,
    filters.kind ?? null,
    filters.quick ?? null,
    filters.search ?? null,
  ] as const

function inboxUrl(
  workspaceId: string,
  filters: NotificationInboxFilters,
  cursor?: string,
): string {
  const params = new URLSearchParams({ folder: filters.folder })
  if (filters.module) params.set('module', filters.module)
  if (filters.kind) params.set('kind', filters.kind)
  if (filters.quick) params.set('quick', filters.quick)
  if (filters.search) params.set('search', filters.search)
  if (cursor) params.set('cursor', cursor)
  return `/api/workspaces/${workspaceId}/notifications?${params.toString()}`
}

/**
 * Contador do cabeçalho: só precisa de `counts`, então pede a página mínima.
 * O SSE (`useNotificationStream`) invalida esta chave quando chega algo novo;
 * o intervalo é a rede de segurança para quando o SSE cair.
 */
export function useNotifications(workspaceId: string | undefined) {
  return useQuery({
    queryKey: NOTIFICATIONS_KEY(workspaceId ?? ''),
    queryFn: () =>
      apiFetch<NotificationListDTO>(
        `/api/workspaces/${workspaceId}/notifications?limit=1`,
        undefined,
        'Erro ao buscar notificações',
      ),
    enabled: Boolean(workspaceId),
    refetchInterval: 60 * 1000,
    staleTime: 30 * 1000,
  })
}

/** Caixa de entrada paginada (rolagem infinita) com os filtros da tela. */
export function useNotificationInbox(
  workspaceId: string,
  filters: NotificationInboxFilters,
  options: { enabled?: boolean } = {},
) {
  return useInfiniteQuery({
    queryKey: INBOX_KEY(workspaceId, filters),
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      apiFetch<NotificationListDTO>(
        inboxUrl(workspaceId, filters, pageParam),
        undefined,
        'Erro ao buscar notificações',
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: NotificationListDTO) =>
      last.nextCursor ?? undefined,
    staleTime: 15 * 1000,
    enabled: options.enabled ?? true,
  })
}

/** Scope of "mark all as read" / "archive all read": the screen's filter. */
export interface NotificationBulkScope {
  module?: NotificationModule
  kind?: string
}

/**
 * Marca como lidas: uma lista de `ids`, ou todas (opcionalmente só as do
 * módulo/tipo filtrado na tela).
 */
export function useMarkNotificationsRead(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input?: string[] | NotificationBulkScope) =>
      apiFetch<NotificationActionResultDTO>(
        `/api/workspaces/${workspaceId}/notifications/read`,
        {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify(
            Array.isArray(input) ? { ids: input } : (input ?? {}),
          ),
        },
        'Erro ao marcar notificações como lidas',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: NOTIFICATIONS_KEY(workspaceId),
      })
    },
  })
}

/** "Arquivar lidas" (all, or only the screen's module/kind). */
export function useArchiveReadNotifications(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (scope: NotificationBulkScope = {}) =>
      apiFetch<NotificationActionResultDTO>(
        `/api/workspaces/${workspaceId}/notifications/archive-read`,
        { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(scope) },
        'Erro ao arquivar as notificações lidas',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: NOTIFICATIONS_KEY(workspaceId),
      })
    },
  })
}

/** Snooze until a preset; undo with the `unsnooze` action. */
export function useSnoozeNotifications(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { ids: string[]; preset: NotificationSnoozePreset }) =>
      apiFetch<NotificationSnoozeResultDTO>(
        `/api/workspaces/${workspaceId}/notifications/snooze`,
        { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(input) },
        'Erro ao adiar as notificações',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: NOTIFICATIONS_KEY(workspaceId),
      })
    },
  })
}

export interface NotificationActionInput {
  action: NotificationAction
  ids: string[]
}

/**
 * Ação de cliente de e-mail (uma linha ou um lote). Invalida tudo que começa
 * com `['notifications', workspaceId]` — a lista de cada pasta e o contador
 * do cabeçalho.
 */
export function useNotificationAction(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: NotificationActionInput) =>
      apiFetch<NotificationActionResultDTO>(
        `/api/workspaces/${workspaceId}/notifications/actions`,
        {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify(input),
        },
        'Erro ao atualizar notificações',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: NOTIFICATIONS_KEY(workspaceId),
      })
    },
  })
}

/**
 * O que o painel de leitura mostra quando a notificação aponta para um
 * chamado. Recorte local de propósito: a caixa de entrada não importa os
 * tipos do ServiceDesk, só sabe que *existe* um resumo possível naquele
 * `href`. Qualquer módulo que exponha um endpoint parecido entra do mesmo
 * jeito.
 */
export interface NotificationTicketSummary {
  /** Real id, for "assign to me" (`PATCH .../tickets/<id>`). */
  id?: string
  code: string
  phase: { name: string; color: string | null } | null
  priority: { name: string; color: string | null } | null
  /** Current assignee; `null` = unassigned ("Atribuir a mim"). */
  assignee?: { id: string; name: string } | null
}

/**
 * Resumo leve do chamado referenciado pelo `href`. Degrada em silêncio: sem
 * link de chamado, sem acesso ao módulo ou com o chamado apagado, devolve
 * `undefined` e o painel mostra só a notificação.
 */
export function useNotificationTicketSummary(
  workspaceId: string,
  href: string | null | undefined,
) {
  const ref = notificationTicketRef(href)

  return useQuery({
    queryKey: ['notifications', workspaceId, 'ticket', ref?.ticketRef ?? ''],
    queryFn: async (): Promise<NotificationTicketSummary | null> => {
      try {
        return await apiFetch<NotificationTicketSummary>(
          `/api/workspaces/${workspaceId}/servicedesk/tickets/${ref?.ticketRef}`,
        )
      } catch {
        return null
      }
    },
    enabled: Boolean(workspaceId && ref),
    retry: false,
    staleTime: 60 * 1000,
  })
}

/** Payload of one SSE line (see `NotificationRealtimeEvent`). */
export interface NotificationStreamEvent {
  type?: string
  kind?: string
  at?: string
  title?: string
  body?: string
  href?: string | null
}

type StreamListener = (event: NotificationStreamEvent | null) => void

/**
 * Uma conexão SSE por workspace, compartilhada entre quem chamar o hook (o
 * botão do cabeçalho e a caixa de entrada ficam montados ao mesmo tempo). O
 * contador de assinantes fecha o `EventSource` quando o último sai.
 */
const streams = new Map<
  string,
  { source: EventSource; listeners: Set<StreamListener> }
>()

function parseStreamEvent(data: unknown): NotificationStreamEvent | null {
  if (typeof data !== 'string') return null
  try {
    const parsed = JSON.parse(data) as unknown
    return parsed && typeof parsed === 'object'
      ? (parsed as NotificationStreamEvent)
      : null
  } catch {
    return null
  }
}

function subscribeToStream(
  workspaceId: string,
  onEvent: StreamListener,
): () => void {
  let stream = streams.get(workspaceId)
  if (!stream) {
    const source = new EventSource(
      `/api/workspaces/${workspaceId}/notifications/events`,
    )
    stream = { source, listeners: new Set() }
    source.onmessage = (message: MessageEvent) => {
      const event = parseStreamEvent(message.data)
      for (const listener of stream?.listeners ?? []) listener(event)
    }
    // Erro de rede: o próprio EventSource reconecta; nada a fazer aqui além
    // de não derrubar a tela.
    source.onerror = () => undefined
    streams.set(workspaceId, stream)
  }

  const current = stream
  current.listeners.add(onEvent)

  return () => {
    current.listeners.delete(onEvent)
    if (current.listeners.size === 0) {
      current.source.close()
      streams.delete(workspaceId)
    }
  }
}

/**
 * Tempo real: SSE genérico `/notifications/events`. Qualquer notificação nova
 * do usuário invalida as queries de notificação, então a lista e o contador
 * do cabeçalho se atualizam sem recarregar. Ambiente sem `EventSource`
 * (SSR, jsdom) simplesmente não assina — o `refetchInterval` cobre.
 */
export function useNotificationStream(workspaceId: string | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!workspaceId) return
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return
    }

    return subscribeToStream(workspaceId, () => {
      queryClient.invalidateQueries({
        queryKey: NOTIFICATIONS_KEY(workspaceId),
      })
    })
  }, [workspaceId, queryClient])
}

/**
 * Listens to the same shared SSE connection and hands every parsed event to
 * `onEvent` (desktop notifications). The latest callback is always used.
 */
export function useNotificationStreamEvents(
  workspaceId: string | undefined,
  onEvent: (event: NotificationStreamEvent) => void,
) {
  const callback = useRef(onEvent)
  callback.current = onEvent

  useEffect(() => {
    if (!workspaceId) return
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return
    }
    return subscribeToStream(workspaceId, (event) => {
      if (event) callback.current(event)
    })
  }, [workspaceId])
}

/* ----------------------------- AI pendings ----------------------------- */

const AI_PENDING_KEY = (workspaceId: string) =>
  [...NOTIFICATIONS_KEY(workspaceId), 'ai-pending'] as const

/**
 * "Pendências da IA" (own assistant actions + agent approvals the user can
 * decide). Lives under the notifications key, so the SSE refresh and every
 * inbox mutation refresh it too.
 */
export function useInboxAiPending(workspaceId: string | undefined) {
  return useQuery({
    queryKey: AI_PENDING_KEY(workspaceId ?? ''),
    queryFn: () =>
      apiFetch<InboxAiPendingListDTO>(
        `/api/workspaces/${workspaceId}/notifications/ai-pending`,
        undefined,
        'Erro ao buscar as pendências da IA',
      ),
    enabled: Boolean(workspaceId),
    refetchInterval: 60 * 1000,
    staleTime: 15 * 1000,
  })
}

export type InboxAiDecision =
  | { source: 'ASSISTANT'; decision: 'confirm' | 'cancel' }
  | { source: 'AGENT'; decision: 'approve' | 'reject'; runId: string }

function decisionUrl(
  workspaceId: string,
  actionId: string,
  input: InboxAiDecision,
): string {
  const base = `/api/workspaces/${workspaceId}`
  return input.source === 'ASSISTANT'
    ? `${base}/ai/actions/${actionId}/${input.decision}`
    : `${base}/agents/runs/${input.runId}/actions/${actionId}/${input.decision}`
}

/**
 * Decides a pending item straight from the inbox, through the same routes
 * the chat and the agent run screen use (the server re-checks everything).
 */
export function useDecideInboxAiPending(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      actionId,
      doubleConfirmed,
      ...input
    }: InboxAiDecision & { actionId: string; doubleConfirmed?: boolean }) => {
      const positive =
        input.decision === 'confirm' || input.decision === 'approve'
      return apiFetch<AiPendingActionDTO>(
        decisionUrl(workspaceId, actionId, input),
        {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify(
            positive && doubleConfirmed ? { doubleConfirmed: true } : {},
          ),
        },
        positive ? 'Erro ao executar a ação' : 'Erro ao cancelar a ação',
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: AI_PENDING_KEY(workspaceId) })
      // The chat transcript and the agent run screen show the same action.
      queryClient.invalidateQueries({ queryKey: ['steel-ai', workspaceId] })
      queryClient.invalidateQueries({ queryKey: ['steel-agents', workspaceId] })
    },
  })
}

/* ------------------------- browser notifications ------------------------ */

const DELIVERY_KEY = (workspaceId: string) =>
  [...NOTIFICATIONS_KEY(workspaceId), 'delivery'] as const

export function useNotificationDelivery(workspaceId: string | undefined) {
  return useQuery({
    queryKey: DELIVERY_KEY(workspaceId ?? ''),
    queryFn: () =>
      apiFetch<NotificationDeliveryDTO>(
        `/api/workspaces/${workspaceId}/notifications/preferences/delivery`,
        undefined,
        'Erro ao carregar as preferências de entrega',
      ),
    enabled: Boolean(workspaceId),
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateNotificationDelivery(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: NotificationDeliveryDTO) =>
      apiFetch<NotificationDeliveryDTO>(
        `/api/workspaces/${workspaceId}/notifications/preferences/delivery`,
        { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(input) },
        'Erro ao salvar a preferência',
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(DELIVERY_KEY(workspaceId), data)
    },
  })
}

/* ------------------------- record quick actions ------------------------- */

/** What "assign to me" needs from a WhatsApp conversation. */
export interface NotificationConversationSummary {
  id: string
  assignedUserId: string | null
}

/** Conversation behind a notification `href`, for "assign to me". */
export function useNotificationConversationSummary(
  workspaceId: string,
  href: string | null | undefined,
) {
  const ref = notificationConversationRef(href)

  return useQuery({
    queryKey: [
      ...NOTIFICATIONS_KEY(workspaceId),
      'conversation',
      ref?.conversationId ?? '',
    ],
    queryFn: async (): Promise<NotificationConversationSummary | null> => {
      try {
        return await apiFetch<NotificationConversationSummary>(
          `/api/workspaces/${workspaceId}/whatsapp/conversations/${ref?.conversationId}`,
        )
      } catch {
        return null
      }
    },
    enabled: Boolean(workspaceId && ref),
    retry: false,
    staleTime: 30 * 1000,
  })
}

export type NotificationAssignTarget =
  | { type: 'ticket'; id: string }
  | { type: 'conversation'; id: string }

/** "Atribuir a mim" for an unassigned ticket or conversation. */
export function useAssignFromNotification(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      target,
      userId,
    }: {
      target: NotificationAssignTarget
      userId: string
    }) =>
      target.type === 'ticket'
        ? apiFetch<unknown>(
            `/api/workspaces/${workspaceId}/servicedesk/tickets/${target.id}`,
            {
              method: 'PATCH',
              headers: JSON_HEADERS,
              body: JSON.stringify({ assigneeId: userId }),
            },
            'Erro ao atribuir o chamado',
          )
        : apiFetch<unknown>(
            `/api/workspaces/${workspaceId}/whatsapp/conversations/${target.id}/assign`,
            {
              method: 'PATCH',
              headers: JSON_HEADERS,
              body: JSON.stringify({ assignedUserId: userId }),
            },
            'Erro ao atribuir a conversa',
          ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: NOTIFICATIONS_KEY(workspaceId),
      })
    },
  })
}
