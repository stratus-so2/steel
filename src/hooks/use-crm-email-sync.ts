import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CrmCalendarEventDTO,
  CrmEmailAccountDTO,
  CrmEmailMessageDTO,
  CrmEmailProviderDTO,
  CrmMailDirectionDTO,
} from '@/types/crm-email-sync'
import { apiFetch, apiSend } from './_fetch'

function emailAccountsKey(workspaceId: string) {
  return ['crm-email-accounts', workspaceId] as const
}

function emailMessagesKey(workspaceId: string) {
  return ['crm-email-messages', workspaceId] as const
}

function calendarEventsKey(workspaceId: string) {
  return ['crm-calendar-events', workspaceId] as const
}

export function useCrmEmailAccounts(workspaceId: string) {
  return useQuery({
    queryKey: emailAccountsKey(workspaceId),
    queryFn: () =>
      apiFetch<CrmEmailAccountDTO[]>(
        `/api/workspaces/${workspaceId}/crm/email-accounts`,
        undefined,
        'Erro ao buscar contas de e-mail',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
  })
}

export function useCreateCrmEmailAccount(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { provider: CrmEmailProviderDTO; email: string }) =>
      apiFetch<CrmEmailAccountDTO>(
        `/api/workspaces/${workspaceId}/crm/email-accounts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao criar conta de e-mail',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: emailAccountsKey(workspaceId),
      })
    },
  })
}

export function useDeleteCrmEmailAccount(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (accountId: string) =>
      apiSend(
        `/api/workspaces/${workspaceId}/crm/email-accounts/${accountId}`,
        { method: 'DELETE' },
        'Erro ao remover conta de e-mail',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: emailAccountsKey(workspaceId),
      })
    },
  })
}

export function useCrmEmailMessages(workspaceId: string) {
  return useQuery({
    queryKey: emailMessagesKey(workspaceId),
    queryFn: () =>
      apiFetch<CrmEmailMessageDTO[]>(
        `/api/workspaces/${workspaceId}/crm/email-messages`,
        undefined,
        'Erro ao buscar e-mails registrados',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
  })
}

export function useCreateCrmEmailMessage(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      direction: CrmMailDirectionDTO
      subject?: string
      fromEmail: string
      toEmails: string[]
      sentAt: string
    }) =>
      apiFetch<CrmEmailMessageDTO>(
        `/api/workspaces/${workspaceId}/crm/email-messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao registrar e-mail',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: emailMessagesKey(workspaceId),
      })
    },
  })
}

export function useDeleteCrmEmailMessage(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (messageId: string) =>
      apiSend(
        `/api/workspaces/${workspaceId}/crm/email-messages/${messageId}`,
        { method: 'DELETE' },
        'Erro ao remover e-mail registrado',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: emailMessagesKey(workspaceId),
      })
    },
  })
}

export function useCrmCalendarEvents(workspaceId: string) {
  return useQuery({
    queryKey: calendarEventsKey(workspaceId),
    queryFn: () =>
      apiFetch<CrmCalendarEventDTO[]>(
        `/api/workspaces/${workspaceId}/crm/calendar-events`,
        undefined,
        'Erro ao buscar eventos de agenda',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
  })
}

export function useCreateCrmCalendarEvent(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { title: string; startsAt: string; endsAt: string }) =>
      apiFetch<CrmCalendarEventDTO>(
        `/api/workspaces/${workspaceId}/crm/calendar-events`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao criar evento',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: calendarEventsKey(workspaceId),
      })
    },
  })
}

export function useDeleteCrmCalendarEvent(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (eventId: string) =>
      apiSend(
        `/api/workspaces/${workspaceId}/crm/calendar-events/${eventId}`,
        { method: 'DELETE' },
        'Erro ao remover evento',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: calendarEventsKey(workspaceId),
      })
    },
  })
}
