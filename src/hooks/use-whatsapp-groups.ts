import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { WhatsAppGroupDTO } from '@/types/whatsapp-group'
import { apiFetch } from './_fetch'

const GROUPS_KEY = (workspaceId: string, archived?: boolean) =>
  ['whatsapp-groups', workspaceId, archived ?? false] as const

function invalidateGroups(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
) {
  queryClient.invalidateQueries({ queryKey: ['whatsapp-groups', workspaceId] })
}

export function useWhatsAppGroups(workspaceId: string, archived?: boolean) {
  return useQuery({
    queryKey: GROUPS_KEY(workspaceId, archived),
    queryFn: () =>
      apiFetch<WhatsAppGroupDTO[]>(
        `/api/workspaces/${workspaceId}/whatsapp/groups${archived ? '?archived=true' : ''}`,
        undefined,
        'Erro ao buscar grupos',
      ),
    staleTime: 15 * 1000,
  })
}

export function useCreateWhatsAppGroup(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      connectionId: string
      name: string
      participantWaIds: string[]
    }) =>
      apiFetch<WhatsAppGroupDTO>(
        `/api/workspaces/${workspaceId}/whatsapp/groups`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao criar grupo',
      ),
    onSuccess: () => invalidateGroups(queryClient, workspaceId),
  })
}

export function useUpdateWhatsAppGroup(workspaceId: string, groupId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      name?: string
      description?: string
      imageUrl?: string
    }) =>
      apiFetch<WhatsAppGroupDTO>(
        `/api/workspaces/${workspaceId}/whatsapp/groups/${groupId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao atualizar grupo',
      ),
    onSuccess: () => invalidateGroups(queryClient, workspaceId),
  })
}

export function useAddWhatsAppGroupParticipants(
  workspaceId: string,
  groupId: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (waIds: string[]) =>
      apiFetch<WhatsAppGroupDTO>(
        `/api/workspaces/${workspaceId}/whatsapp/groups/${groupId}/participants`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ waIds }),
        },
        'Erro ao adicionar participantes',
      ),
    onSuccess: () => invalidateGroups(queryClient, workspaceId),
  })
}

export function useRemoveWhatsAppGroupParticipants(
  workspaceId: string,
  groupId: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (waIds: string[]) =>
      apiFetch<WhatsAppGroupDTO>(
        `/api/workspaces/${workspaceId}/whatsapp/groups/${groupId}/participants`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ waIds }),
        },
        'Erro ao remover participantes',
      ),
    onSuccess: () => invalidateGroups(queryClient, workspaceId),
  })
}

export function useSetWhatsAppGroupAdmin(workspaceId: string, groupId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { waId: string; admin: boolean }) =>
      apiFetch<WhatsAppGroupDTO>(
        `/api/workspaces/${workspaceId}/whatsapp/groups/${groupId}/admins`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao atualizar administrador',
      ),
    onSuccess: () => invalidateGroups(queryClient, workspaceId),
  })
}

export function useWhatsAppGroupInviteLink(
  workspaceId: string,
  groupId: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      apiFetch<{ inviteLink: string }>(
        `/api/workspaces/${workspaceId}/whatsapp/groups/${groupId}/invite-link`,
        { method: 'POST' },
        'Erro ao obter link de convite',
      ),
    onSuccess: () => invalidateGroups(queryClient, workspaceId),
  })
}

export function useLeaveWhatsAppGroup(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (groupId: string) =>
      apiFetch<{ id: string }>(
        `/api/workspaces/${workspaceId}/whatsapp/groups/${groupId}/leave`,
        { method: 'POST' },
        'Erro ao sair do grupo',
      ),
    onSuccess: () => invalidateGroups(queryClient, workspaceId),
  })
}
