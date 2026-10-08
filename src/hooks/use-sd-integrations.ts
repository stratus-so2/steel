import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CreateSdGithubIssueDTO,
  LinkSdGithubItemDTO,
  UpdateSdRepoConfigDTO,
  UpdateSdSlackConfigDTO,
} from '@/src/schemas/sd-integration.schema'
import type {
  SdIntegrationDTO,
  SdIntegrationLinkDTO,
  SdIntegrationsOverviewDTO,
  SdRepoProviderDTO,
  SdRepoProviderOptionDTO,
  SdSlackChannelOptionDTO,
} from '@/types/sd-integration'
import { apiFetch, apiSend } from './_fetch'

/**
 * ServiceDesk side of the integrations (Slack, GitHub, GitLab). Everything
 * under `['sd-integrations', workspaceId]`, so any mutation refreshes the
 * whole tab; the ticket links have their own key per ticket. Connecting and
 * disconnecting are workspace-level (`use-workspace-integrations`, ADR 0024).
 */

export const sdIntegrationKeys = {
  all: (workspaceId: string) => ['sd-integrations', workspaceId] as const,
  overview: (workspaceId: string) =>
    ['sd-integrations', workspaceId, 'overview'] as const,
  channels: (workspaceId: string) =>
    ['sd-integrations', workspaceId, 'slack-channels'] as const,
  links: (workspaceId: string, ticketId: string) =>
    ['sd-integrations', workspaceId, 'links', ticketId] as const,
}

function base(workspaceId: string) {
  return `/api/workspaces/${workspaceId}/servicedesk/integrations`
}

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

export function useSdIntegrations(workspaceId: string) {
  return useQuery({
    queryKey: sdIntegrationKeys.overview(workspaceId),
    queryFn: () =>
      apiFetch<SdIntegrationsOverviewDTO>(
        base(workspaceId),
        undefined,
        'Erro ao carregar as integrações',
      ),
    enabled: !!workspaceId,
  })
}

/** Slack channels — only fetched when Slack is connected. */
export function useSdSlackChannels(
  workspaceId: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: sdIntegrationKeys.channels(workspaceId),
    queryFn: () =>
      apiFetch<SdSlackChannelOptionDTO[]>(
        `${base(workspaceId)}/slack/channels`,
        undefined,
        'Erro ao carregar os canais do Slack',
      ),
    enabled: !!workspaceId && (options.enabled ?? false),
    staleTime: 5 * 60 * 1000,
  })
}

export function useSdIntegrationMutations(workspaceId: string) {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: sdIntegrationKeys.all(workspaceId),
    })
  const url = base(workspaceId)

  const updateSlack = useMutation({
    mutationFn: (data: UpdateSdSlackConfigDTO) =>
      apiFetch<SdIntegrationDTO>(
        `${url}/slack`,
        json('PATCH', data),
        'Erro ao salvar a configuração do Slack',
      ),
    onSuccess: invalidate,
  })
  const updateRepo = useMutation({
    mutationFn: ({
      provider,
      ...data
    }: UpdateSdRepoConfigDTO & { provider: SdRepoProviderDTO }) =>
      apiFetch<SdIntegrationDTO>(
        `${url}/${provider.toLowerCase()}`,
        json('PATCH', data),
        'Erro ao salvar a configuração do repositório',
      ),
    onSuccess: invalidate,
  })

  return { updateSlack, updateRepo }
}

/** Ticket links (Slack thread, issues, PRs and MRs). */
export function useSdIntegrationLinks(
  workspaceId: string,
  ticketId: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: sdIntegrationKeys.links(workspaceId, ticketId),
    queryFn: () =>
      apiFetch<SdIntegrationLinkDTO[]>(
        `${base(workspaceId)}/links?ticketId=${encodeURIComponent(ticketId)}`,
        undefined,
        'Erro ao carregar os vínculos do chamado',
      ),
    enabled: !!workspaceId && !!ticketId && (options.enabled ?? true),
  })
}

/** GitHub/GitLab connected to the workspace, as offered on the ticket. */
export function useSdRepoProviders(
  workspaceId: string,
  ticketId: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: [...sdIntegrationKeys.all(workspaceId), 'providers', ticketId],
    queryFn: () =>
      apiFetch<SdRepoProviderOptionDTO[]>(
        `${base(workspaceId)}/providers?ticketId=${encodeURIComponent(ticketId)}`,
        undefined,
        'Erro ao carregar os repositórios conectados',
      ),
    enabled: !!workspaceId && !!ticketId && (options.enabled ?? true),
    staleTime: 60 * 1000,
  })
}

export function useSdIntegrationLinkMutations(
  workspaceId: string,
  ticketId: string,
) {
  const queryClient = useQueryClient()
  const url = base(workspaceId)
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: sdIntegrationKeys.links(workspaceId, ticketId),
    })

  const link = useMutation({
    mutationFn: (data: LinkSdGithubItemDTO) =>
      apiFetch<SdIntegrationLinkDTO>(
        `${url}/links`,
        json('POST', data),
        'Erro ao vincular o item',
      ),
    onSuccess: invalidate,
  })
  const createIssue = useMutation({
    mutationFn: ({
      provider = 'GITHUB',
      ...data
    }: CreateSdGithubIssueDTO & { provider?: SdRepoProviderDTO }) =>
      apiFetch<SdIntegrationLinkDTO>(
        `${url}/${provider.toLowerCase()}/issues`,
        json('POST', data),
        'Erro ao abrir a issue',
      ),
    onSuccess: invalidate,
  })
  const unlink = useMutation({
    mutationFn: (linkId: string) =>
      apiSend(
        `${url}/links/${linkId}`,
        { method: 'DELETE' },
        'Erro ao desvincular',
      ),
    onSuccess: invalidate,
  })

  return { link, createIssue, unlink }
}
