import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ConnectSdGithubDTO,
  CreateSdGithubIssueDTO,
  LinkSdGithubItemDTO,
  UpdateSdGithubConfigDTO,
  UpdateSdSlackConfigDTO,
} from '@/src/schemas/sd-integration.schema'
import type {
  SdIntegrationDTO,
  SdIntegrationLinkDTO,
  SdIntegrationsOverviewDTO,
  SdSlackChannelOptionDTO,
} from '@/types/sd-integration'
import { apiFetch, apiSend } from './_fetch'

/**
 * Integrações do ServiceDesk (Slack e GitHub). Tudo sob
 * `['sd-integrations', workspaceId]`, então qualquer mutação atualiza a aba
 * inteira; os vínculos do chamado ficam numa chave própria por chamado.
 *
 * O token e o segredo do webhook **só entram** — nenhuma resposta os traz de
 * volta. A conexão do Slack não é mutação: é um redirect do navegador para
 * `…/integrations/slack/connect`.
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

function useInvalidate(workspaceId: string) {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({
      queryKey: sdIntegrationKeys.all(workspaceId),
    })
}

/** URL para onde o botão "Conectar" do Slack manda o navegador. */
export function sdSlackConnectUrl(workspaceId: string): string {
  return `${base(workspaceId)}/slack/connect`
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

/** Canais do Slack — só busca quando o Slack está conectado. */
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
  const invalidate = useInvalidate(workspaceId)
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
  const disconnectSlack = useMutation({
    mutationFn: () =>
      apiSend(
        `${url}/slack`,
        { method: 'DELETE' },
        'Erro ao desconectar o Slack',
      ),
    onSuccess: invalidate,
  })
  const connectGithub = useMutation({
    mutationFn: (data: ConnectSdGithubDTO) =>
      apiFetch<SdIntegrationDTO>(
        `${url}/github`,
        json('POST', data),
        'Erro ao conectar o repositório',
      ),
    onSuccess: invalidate,
  })
  const updateGithub = useMutation({
    mutationFn: (data: UpdateSdGithubConfigDTO) =>
      apiFetch<SdIntegrationDTO>(
        `${url}/github`,
        json('PATCH', data),
        'Erro ao salvar a configuração do GitHub',
      ),
    onSuccess: invalidate,
  })
  const disconnectGithub = useMutation({
    mutationFn: () =>
      apiSend(
        `${url}/github`,
        { method: 'DELETE' },
        'Erro ao desconectar o GitHub',
      ),
    onSuccess: invalidate,
  })

  return {
    updateSlack,
    disconnectSlack,
    connectGithub,
    updateGithub,
    disconnectGithub,
  }
}

/** Vínculos do chamado (thread do Slack, issues e PRs). */
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
        'Erro ao vincular a issue',
      ),
    onSuccess: invalidate,
  })
  const createIssue = useMutation({
    mutationFn: (data: CreateSdGithubIssueDTO) =>
      apiFetch<SdIntegrationLinkDTO>(
        `${url}/github/issues`,
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
