import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NotificationListDTO } from '@/types/notification'
import { apiFetch } from './_fetch'

const NOTIFICATIONS_KEY = (workspaceId: string) =>
  ['notifications', workspaceId] as const

export function useNotifications(workspaceId: string | undefined) {
  return useQuery({
    queryKey: NOTIFICATIONS_KEY(workspaceId ?? ''),
    queryFn: () =>
      apiFetch<NotificationListDTO>(
        `/api/workspaces/${workspaceId}/notifications`,
        undefined,
        'Erro ao buscar notificações',
      ),
    enabled: Boolean(workspaceId),
    // Sem canal em tempo real por usuário: atualiza a cada minuto.
    refetchInterval: 60 * 1000,
    staleTime: 30 * 1000,
  })
}

export function useMarkNotificationsRead(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (ids?: string[]) =>
      apiFetch<{ updated: number }>(
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
