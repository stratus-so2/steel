import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { WhatsAppContactDTO } from '@/types/whatsapp-contact'
import { apiFetch, apiSend } from './_fetch'

const CONTACTS_KEY = (workspaceId: string, search?: string) =>
  ['whatsapp-contacts', workspaceId, search ?? ''] as const

interface CreateWhatsAppContactInput {
  waId: string
  name?: string
  avatarUrl?: string
}

interface UpdateWhatsAppContactInput {
  name?: string
  avatarUrl?: string
}

export function useWhatsAppContacts(workspaceId: string, search?: string) {
  return useQuery({
    queryKey: CONTACTS_KEY(workspaceId, search),
    queryFn: () =>
      apiFetch<WhatsAppContactDTO[]>(
        `/api/workspaces/${workspaceId}/whatsapp/contacts${search ? `?search=${encodeURIComponent(search)}` : ''}`,
        undefined,
        'Erro ao buscar contatos',
      ),
    staleTime: 30 * 1000,
  })
}

export function useCreateWhatsAppContact(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateWhatsAppContactInput) =>
      apiFetch<WhatsAppContactDTO>(
        `/api/workspaces/${workspaceId}/whatsapp/contacts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao criar contato',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['whatsapp-contacts', workspaceId],
      })
    },
  })
}

export function useUpdateWhatsAppContact(
  workspaceId: string,
  contactId: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateWhatsAppContactInput) =>
      apiFetch<WhatsAppContactDTO>(
        `/api/workspaces/${workspaceId}/whatsapp/contacts/${contactId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao atualizar contato',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['whatsapp-contacts', workspaceId],
      })
    },
  })
}

export function useDeleteWhatsAppContact(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (contactId: string) =>
      apiSend(
        `/api/workspaces/${workspaceId}/whatsapp/contacts/${contactId}`,
        { method: 'DELETE' },
        'Erro ao remover contato',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['whatsapp-contacts', workspaceId],
      })
    },
  })
}
