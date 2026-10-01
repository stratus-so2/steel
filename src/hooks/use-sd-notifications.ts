import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UpdateSdNotificationPreferencesDTO } from '@/src/schemas/sd-notification.schema'
import type {
  SdNotificationPreferencesDTO,
  SdTicketFollowersDTO,
} from '@/types/sd-notification'
import { apiFetch } from './_fetch'
import { sdJson } from './_sd-ticket-tab'

/**
 * Central de notificações do ServiceDesk: preferências do usuário
 * (`/servicedesk/notification-preferences`) e seguir/parar de seguir um
 * chamado (`/servicedesk/tickets/<ref>/followers`).
 */

export const sdNotificationKeys = {
  preferences: (workspaceId: string) =>
    ['sd-notification-preferences', workspaceId] as const,
  followers: (workspaceId: string, ticketRef: string) =>
    ['sd-tickets', workspaceId, 'followers', ticketRef] as const,
}

function preferencesUrl(workspaceId: string): string {
  return `/api/workspaces/${workspaceId}/servicedesk/notification-preferences`
}

function followersUrl(workspaceId: string, ticketRef: string): string {
  return `/api/workspaces/${workspaceId}/servicedesk/tickets/${encodeURIComponent(ticketRef)}/followers`
}

export function useSdNotificationPreferences(workspaceId: string) {
  return useQuery({
    queryKey: sdNotificationKeys.preferences(workspaceId),
    queryFn: () =>
      apiFetch<SdNotificationPreferencesDTO>(
        preferencesUrl(workspaceId),
        undefined,
        'Erro ao carregar as preferências de notificação',
      ),
    enabled: Boolean(workspaceId),
  })
}

export function useSaveSdNotificationPreferences(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateSdNotificationPreferencesDTO) =>
      apiFetch<SdNotificationPreferencesDTO>(
        preferencesUrl(workspaceId),
        sdJson('PUT', input),
        'Erro ao salvar as preferências',
      ),
    onSuccess: (data) =>
      qc.setQueryData(sdNotificationKeys.preferences(workspaceId), data),
  })
}

/** Volta aos padrões do catálogo (apaga o que o usuário salvou). */
export function useRestoreSdNotificationPreferences(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<SdNotificationPreferencesDTO>(
        preferencesUrl(workspaceId),
        sdJson('DELETE'),
        'Erro ao restaurar os padrões',
      ),
    onSuccess: (data) =>
      qc.setQueryData(sdNotificationKeys.preferences(workspaceId), data),
  })
}

export function useSdTicketFollowers(workspaceId: string, ticketRef: string) {
  return useQuery({
    queryKey: sdNotificationKeys.followers(workspaceId, ticketRef),
    queryFn: () =>
      apiFetch<SdTicketFollowersDTO>(
        followersUrl(workspaceId, ticketRef),
        undefined,
        'Erro ao carregar quem segue o chamado',
      ),
    enabled: Boolean(workspaceId && ticketRef),
  })
}

/** Alterna entre seguir e parar de seguir (ambos idempotentes). */
export function useToggleSdTicketFollow(
  workspaceId: string,
  ticketRef: string,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (follow: boolean) =>
      apiFetch<SdTicketFollowersDTO>(
        followersUrl(workspaceId, ticketRef),
        sdJson(follow ? 'POST' : 'DELETE'),
        follow
          ? 'Erro ao seguir o chamado'
          : 'Erro ao parar de seguir o chamado',
      ),
    onSuccess: (data) =>
      qc.setQueryData(
        sdNotificationKeys.followers(workspaceId, ticketRef),
        data,
      ),
  })
}
