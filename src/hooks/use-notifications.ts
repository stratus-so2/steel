import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useEffect } from 'react'
import {
  type NotificationModule,
  notificationTicketRef,
} from '@/src/lib/notification-kind'
import type {
  NotificationAction,
  NotificationFolder,
} from '@/src/schemas/notification.schema'
import type {
  NotificationActionResultDTO,
  NotificationListDTO,
} from '@/types/notification'
import { apiFetch } from './_fetch'

const NOTIFICATIONS_KEY = (workspaceId: string) =>
  ['notifications', workspaceId] as const

export interface NotificationInboxFilters {
  folder: NotificationFolder
  module?: NotificationModule
  kind?: string
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
  })
}

export function useMarkNotificationsRead(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (ids?: string[]) =>
      apiFetch<NotificationActionResultDTO>(
        `/api/workspaces/${workspaceId}/notifications/read`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ids ? { ids } : {}),
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
          headers: { 'Content-Type': 'application/json' },
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
  code: string
  phase: { name: string; color: string | null } | null
  priority: { name: string; color: string | null } | null
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

    const source = new EventSource(
      `/api/workspaces/${workspaceId}/notifications/events`,
    )
    source.onmessage = () => {
      queryClient.invalidateQueries({
        queryKey: NOTIFICATIONS_KEY(workspaceId),
      })
    }
    // Erro de rede: o próprio EventSource reconecta; nada a fazer aqui além
    // de não derrubar a tela.
    source.onerror = () => undefined

    return () => source.close()
  }, [workspaceId, queryClient])
}
