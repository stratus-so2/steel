/**
 * DTOs das integrações do ServiceDesk (Slack e GitHub). O token do app e o
 * segredo do webhook **nunca** entram em DTO — nem mascarados: a interface
 * mostra apenas se existe um segredo configurado (`hasWebhookSecret`).
 */

export type SdIntegrationKindDTO = 'SLACK' | 'GITHUB'
export type SdIntegrationStatusDTO = 'ACTIVE' | 'ERROR' | 'DISCONNECTED'
export type SdIntegrationLinkKindDTO =
  | 'SLACK_THREAD'
  | 'GITHUB_ISSUE'
  | 'GITHUB_PULL_REQUEST'

export interface SdSlackChannelMapDTO {
  departmentId: string | null
  channelId: string
  channelName: string | null
}

export interface SdSlackConfigDTO {
  channels: SdSlackChannelMapDTO[]
  events: string[]
  allowTicketFromMessage: boolean
  mirrorThreadReplies: boolean
  ticketType: 'INCIDENT' | 'SERVICE_REQUEST' | 'CHANGE' | 'PROBLEM'
  departmentId: string | null
}

export interface SdGithubConfigDTO {
  suggestPhaseOnClose: boolean
  allowIssueFromTicket: boolean
}

export interface SdIntegrationDTO {
  id: string
  kind: SdIntegrationKindDTO
  status: SdIntegrationStatusDTO
  statusError: string | null
  /** Workspace do Slack (`T…`) ou `owner/repo` no GitHub. */
  externalId: string
  externalName: string | null
  /** Existe segredo de assinatura guardado (GitHub). */
  hasWebhookSecret: boolean
  slack: SdSlackConfigDTO | null
  github: SdGithubConfigDTO | null
  createdAt: string
  updatedAt: string
}

/** Estado da aba Integrações. */
export interface SdIntegrationsOverviewDTO {
  /** O app do Slack tem credenciais no servidor. */
  slackConfigured: boolean
  /** URL a cadastrar no app do Slack (eventos e interatividade). */
  slackEventsUrl: string | null
  /** URL a cadastrar no webhook do repositório do GitHub. */
  githubWebhookUrl: string
  slack: SdIntegrationDTO | null
  github: SdIntegrationDTO | null
}

export interface SdIntegrationLinkDTO {
  id: string
  integrationId: string
  kind: SdIntegrationLinkKindDTO
  ticketId: string
  /** `canal:ts` (Slack) ou `owner/repo#numero` (GitHub). */
  externalKey: string
  externalUrl: string | null
  /** `open`, `closed`, `merged` — `null` para thread do Slack. */
  externalState: string | null
  /** Rótulo pt-BR do estado (`Aberta`, `Fechada`, `Mesclada`). */
  externalStateLabel: string | null
  title: string | null
  createdAt: string
  updatedAt: string
}

/** Canal do Slack oferecido no seletor da aba Integrações. */
export interface SdSlackChannelOptionDTO {
  id: string
  name: string
  isPrivate: boolean
}
