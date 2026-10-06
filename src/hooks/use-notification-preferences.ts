import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UpdateNotificationPreferencesDTO } from '@/src/schemas/notification-preference.schema'
import type { NotificationPreferenceDTO } from '@/types/notification'
import { apiFetch } from './_fetch'

const PREFERENCES_KEY = (workspaceId: string) =>
  ['notification-preferences', workspaceId] as const

const url = (workspaceId: string) =>
  `/api/workspaces/${workspaceId}/notifications/preferences`

/** The user's mute preferences for the non-ServiceDesk kinds. */
export function useNotificationPreferences(workspaceId: string) {
  return useQuery({
    queryKey: PREFERENCES_KEY(workspaceId),
    queryFn: () =>
      apiFetch<NotificationPreferenceDTO[]>(
        url(workspaceId),
        undefined,
        'Erro ao carregar as preferências de notificação',
      ),
    enabled: Boolean(workspaceId),
  })
}

/** Saves one or more kinds; the response is the full updated list. */
export function useUpdateNotificationPreferences(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdateNotificationPreferencesDTO) =>
      apiFetch<NotificationPreferenceDTO[]>(
        url(workspaceId),
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dto),
        },
        'Erro ao salvar as preferências de notificação',
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(PREFERENCES_KEY(workspaceId), data)
    },
  })
}
