'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CrmCampaignAudienceDTO,
  CrmCampaignAudiencePreviewDTO,
  CrmCampaignDetailDTO,
  CrmCampaignEmailPreviewDTO,
  CrmCampaignListItemDTO,
  CrmCampaignOptionsDTO,
  CrmCampaignRecipientPageDTO,
  CrmCampaignStatsDTO,
  CrmCampaignStatusDTO,
  CrmCampaignTestSendResultDTO,
} from '@/types/crm-campaign'
import { apiFetch, apiFetchJson, apiSend } from './_fetch'

/** Draft patch accepted by `PATCH /crm/campaigns/[id]` (any wizard field). */
export type CrmCampaignPatch = Partial<
  Omit<
    CrmCampaignDetailDTO,
    | 'id'
    | 'workspaceId'
    | 'slug'
    | 'status'
    | 'links'
    | 'issues'
    | 'createdAt'
    | 'updatedAt'
    | 'createdById'
    | 'consentConfirmedAt'
    | 'launchedAt'
    | 'startAt'
    | 'completedAt'
  >
>

const base = (workspaceId: string) =>
  `/api/workspaces/${workspaceId}/crm/campaigns`

export const crmCampaignKeys = {
  list: (ws: string) => ['crm-campaigns', ws] as const,
  detail: (ws: string, id: string) => ['crm-campaign', ws, id] as const,
  options: (ws: string) => ['crm-campaign-options', ws] as const,
  stats: (ws: string, id: string) => ['crm-campaign-stats', ws, id] as const,
  recipients: (ws: string, id: string, page: number, search: string) =>
    ['crm-campaign-recipients', ws, id, page, search] as const,
  audience: (ws: string, audience: CrmCampaignAudienceDTO, wa: boolean) =>
    ['crm-campaign-audience', ws, audience, wa] as const,
  preview: (ws: string, id: string, updatedAt: string) =>
    ['crm-campaign-preview', ws, id, updatedAt] as const,
}

/** Statuses whose numbers still move (polled by the dashboard). */
export const LIVE_CAMPAIGN_STATUSES: CrmCampaignStatusDTO[] = [
  'SCHEDULED',
  'SENDING',
]

export function useCrmCampaigns(workspaceId: string) {
  return useQuery({
    queryKey: crmCampaignKeys.list(workspaceId),
    queryFn: () =>
      apiFetch<CrmCampaignListItemDTO[]>(
        base(workspaceId),
        undefined,
        'Erro ao buscar campanhas',
      ),
  })
}

export function useCrmCampaign(workspaceId: string, campaignId: string) {
  return useQuery({
    queryKey: crmCampaignKeys.detail(workspaceId, campaignId),
    queryFn: () =>
      apiFetch<CrmCampaignDetailDTO>(
        `${base(workspaceId)}/${campaignId}`,
        undefined,
        'Erro ao buscar a campanha',
      ),
  })
}

export function useCrmCampaignOptions(workspaceId: string) {
  return useQuery({
    queryKey: crmCampaignKeys.options(workspaceId),
    queryFn: () =>
      apiFetch<CrmCampaignOptionsDTO>(
        `${base(workspaceId)}/options`,
        undefined,
        'Erro ao buscar as opções da campanha',
      ),
    staleTime: 30 * 1000,
  })
}

export function useCrmCampaignAudiencePreview(
  workspaceId: string,
  audience: CrmCampaignAudienceDTO,
  whatsappEnabled: boolean,
) {
  return useQuery({
    queryKey: crmCampaignKeys.audience(workspaceId, audience, whatsappEnabled),
    queryFn: () =>
      apiFetchJson<CrmCampaignAudiencePreviewDTO>(
        `${base(workspaceId)}/audience-preview`,
        'POST',
        { audience, whatsappEnabled },
        'Erro ao contar o público',
      ),
  })
}

export function useCrmCampaignEmailPreview(
  workspaceId: string,
  campaign: Pick<CrmCampaignDetailDTO, 'id' | 'updatedAt' | 'emailTemplateId'>,
) {
  return useQuery({
    queryKey: crmCampaignKeys.preview(
      workspaceId,
      campaign.id,
      campaign.updatedAt,
    ),
    queryFn: () =>
      apiFetch<CrmCampaignEmailPreviewDTO>(
        `${base(workspaceId)}/${campaign.id}/preview`,
        undefined,
        'Erro ao montar a prévia',
      ),
    enabled: Boolean(campaign.emailTemplateId),
  })
}

export function useCrmCampaignStats(
  workspaceId: string,
  campaignId: string,
  live: boolean,
) {
  return useQuery({
    queryKey: crmCampaignKeys.stats(workspaceId, campaignId),
    queryFn: () =>
      apiFetch<CrmCampaignStatsDTO>(
        `${base(workspaceId)}/${campaignId}/stats`,
        undefined,
        'Erro ao buscar os resultados',
      ),
    refetchInterval: live ? 15 * 1000 : false,
  })
}

export function useCrmCampaignRecipients(
  workspaceId: string,
  campaignId: string,
  page: number,
  search: string,
) {
  return useQuery({
    queryKey: crmCampaignKeys.recipients(workspaceId, campaignId, page, search),
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' })
      if (search) params.set('search', search)
      return apiFetch<CrmCampaignRecipientPageDTO>(
        `${base(workspaceId)}/${campaignId}/recipients?${params}`,
        undefined,
        'Erro ao buscar os contatos',
      )
    },
  })
}

function useCampaignMutation<TInput, TOutput>(
  workspaceId: string,
  fn: (input: TInput) => Promise<TOutput>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      const detail = data as unknown as CrmCampaignDetailDTO | undefined
      if (detail && typeof detail === 'object' && 'issues' in detail) {
        queryClient.setQueryData(
          crmCampaignKeys.detail(workspaceId, detail.id),
          detail,
        )
      }
      void queryClient.invalidateQueries({
        queryKey: crmCampaignKeys.list(workspaceId),
      })
    },
  })
}

export function useCreateCrmCampaign(workspaceId: string) {
  return useCampaignMutation(workspaceId, (name: string) =>
    apiFetchJson<CrmCampaignDetailDTO>(
      base(workspaceId),
      'POST',
      { name },
      'Erro ao criar a campanha',
    ),
  )
}

export function useUpdateCrmCampaign(workspaceId: string, campaignId: string) {
  return useCampaignMutation(workspaceId, (patch: CrmCampaignPatch) =>
    apiFetchJson<CrmCampaignDetailDTO>(
      `${base(workspaceId)}/${campaignId}`,
      'PATCH',
      patch,
      'Erro ao salvar a campanha',
    ),
  )
}

export function useLaunchCrmCampaign(workspaceId: string, campaignId: string) {
  return useCampaignMutation(workspaceId, () =>
    apiFetchJson<CrmCampaignDetailDTO>(
      `${base(workspaceId)}/${campaignId}/launch`,
      'POST',
      { confirmLegalBasis: true },
      'Erro ao enviar a campanha',
    ),
  )
}

export function useControlCrmCampaign(workspaceId: string, campaignId: string) {
  return useCampaignMutation(
    workspaceId,
    (action: 'pause' | 'resume' | 'cancel') =>
      apiFetchJson<CrmCampaignDetailDTO>(
        `${base(workspaceId)}/${campaignId}/control`,
        'POST',
        { action },
        'Erro ao atualizar a campanha',
      ),
  )
}

export function useTestSendCrmCampaign(
  workspaceId: string,
  campaignId: string,
) {
  return useMutation({
    mutationFn: (input: { email?: string; phone?: string }) =>
      apiFetchJson<CrmCampaignTestSendResultDTO>(
        `${base(workspaceId)}/${campaignId}/test-send`,
        'POST',
        input,
        'Erro ao enviar o teste',
      ),
  })
}

export function useDeleteCrmCampaign(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (campaignId: string) =>
      apiSend(
        `${base(workspaceId)}/${campaignId}`,
        { method: 'DELETE' },
        'Erro ao excluir a campanha',
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: crmCampaignKeys.list(workspaceId),
      }),
  })
}
