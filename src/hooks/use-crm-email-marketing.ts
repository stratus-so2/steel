import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CrmCampaignRecipientScopeDTO,
  CrmEmailCampaignDTO,
  CrmEmailCampaignRecipientDTO,
  CrmEmailTemplateDTO,
  CrmMailingListDTO,
  CrmMailingListMemberDTO,
} from '@/types/crm-email-marketing'
import { apiFetch, apiSend } from './_fetch'

function emailTemplatesKey(workspaceId: string) {
  return ['crm-email-templates', workspaceId] as const
}

function mailingListsKey(workspaceId: string) {
  return ['crm-mailing-lists', workspaceId] as const
}

function mailingListMembersKey(workspaceId: string, listId: string) {
  return ['crm-mailing-list-members', workspaceId, listId] as const
}

function emailCampaignsKey(workspaceId: string) {
  return ['crm-email-campaigns', workspaceId] as const
}

function emailCampaignRecipientsKey(workspaceId: string, campaignId: string) {
  return ['crm-email-campaign-recipients', workspaceId, campaignId] as const
}

export function useCrmEmailTemplates(workspaceId: string) {
  return useQuery({
    queryKey: emailTemplatesKey(workspaceId),
    queryFn: () =>
      apiFetch<CrmEmailTemplateDTO[]>(
        `/api/workspaces/${workspaceId}/crm/email-templates`,
        undefined,
        'Erro ao buscar templates de e-mail',
      ),
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
  })
}

export function useCreateCrmEmailTemplate(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      name: string
      subject: string
      contentHtml: string
    }) =>
      apiFetch<CrmEmailTemplateDTO>(
        `/api/workspaces/${workspaceId}/crm/email-templates`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao criar template de e-mail',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: emailTemplatesKey(workspaceId),
      })
    },
  })
}

export function useUpdateCrmEmailTemplate(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      templateId,
      data,
    }: {
      templateId: string
      data: { name?: string; subject?: string; contentHtml?: string }
    }) =>
      apiFetch<CrmEmailTemplateDTO>(
        `/api/workspaces/${workspaceId}/crm/email-templates/${templateId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao atualizar template de e-mail',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: emailTemplatesKey(workspaceId),
      })
    },
  })
}

export function useDeleteCrmEmailTemplate(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (templateId: string) =>
      apiSend(
        `/api/workspaces/${workspaceId}/crm/email-templates/${templateId}`,
        { method: 'DELETE' },
        'Erro ao remover template de e-mail',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: emailTemplatesKey(workspaceId),
      })
    },
  })
}

export function useCrmMailingLists(workspaceId: string) {
  return useQuery({
    queryKey: mailingListsKey(workspaceId),
    queryFn: () =>
      apiFetch<CrmMailingListDTO[]>(
        `/api/workspaces/${workspaceId}/crm/mailing-lists`,
        undefined,
        'Erro ao buscar listas de e-mail',
      ),
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
  })
}

export function useCreateCrmMailingList(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      apiFetch<CrmMailingListDTO>(
        `/api/workspaces/${workspaceId}/crm/mailing-lists`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao criar lista de e-mail',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mailingListsKey(workspaceId) })
    },
  })
}

export function useDeleteCrmMailingList(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (listId: string) =>
      apiSend(
        `/api/workspaces/${workspaceId}/crm/mailing-lists/${listId}`,
        { method: 'DELETE' },
        'Erro ao remover lista de e-mail',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mailingListsKey(workspaceId) })
    },
  })
}

export function useCrmMailingListMembers(workspaceId: string, listId: string) {
  return useQuery({
    queryKey: mailingListMembersKey(workspaceId, listId),
    queryFn: () =>
      apiFetch<CrmMailingListMemberDTO[]>(
        `/api/workspaces/${workspaceId}/crm/mailing-lists/${listId}/members`,
        undefined,
        'Erro ao buscar contatos da lista',
      ),
    enabled: !!workspaceId && !!listId,
    staleTime: 30 * 1000,
  })
}

export function useAddCrmMailingListMember(
  workspaceId: string,
  listId: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { email: string; name?: string }) =>
      apiFetch<CrmMailingListMemberDTO>(
        `/api/workspaces/${workspaceId}/crm/mailing-lists/${listId}/members`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao adicionar contato à lista',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: mailingListMembersKey(workspaceId, listId),
      })
    },
  })
}

export function useRemoveCrmMailingListMember(
  workspaceId: string,
  listId: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (memberId: string) =>
      apiSend(
        `/api/workspaces/${workspaceId}/crm/mailing-lists/${listId}/members/${memberId}`,
        { method: 'DELETE' },
        'Erro ao remover contato da lista',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: mailingListMembersKey(workspaceId, listId),
      })
    },
  })
}

export function useCrmEmailCampaigns(workspaceId: string) {
  return useQuery({
    queryKey: emailCampaignsKey(workspaceId),
    queryFn: () =>
      apiFetch<CrmEmailCampaignDTO[]>(
        `/api/workspaces/${workspaceId}/crm/email-campaigns`,
        undefined,
        'Erro ao buscar campanhas de e-mail',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
  })
}

export function useCreateCrmEmailCampaign(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      subject: string
      contentHtml: string
      fromAddress: string
      recipientScope: CrmCampaignRecipientScopeDTO
      mailingListId?: string
      personIds?: string[]
    }) =>
      apiFetch<CrmEmailCampaignDTO>(
        `/api/workspaces/${workspaceId}/crm/email-campaigns`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao criar campanha de e-mail',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: emailCampaignsKey(workspaceId),
      })
    },
  })
}

export function useSendCrmEmailCampaign(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (campaignId: string) =>
      apiFetch<CrmEmailCampaignDTO>(
        `/api/workspaces/${workspaceId}/crm/email-campaigns/${campaignId}/send`,
        { method: 'POST' },
        'Erro ao enviar campanha de e-mail',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: emailCampaignsKey(workspaceId),
      })
    },
  })
}

export function useCrmEmailCampaignRecipients(
  workspaceId: string,
  campaignId: string | null,
) {
  return useQuery({
    queryKey: emailCampaignRecipientsKey(workspaceId, campaignId ?? ''),
    queryFn: () =>
      apiFetch<CrmEmailCampaignRecipientDTO[]>(
        `/api/workspaces/${workspaceId}/crm/email-campaigns/${campaignId}/recipients`,
        undefined,
        'Erro ao buscar destinatários da campanha',
      ),
    enabled: !!workspaceId && !!campaignId,
    staleTime: 15 * 1000,
  })
}
