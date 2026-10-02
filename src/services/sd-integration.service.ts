import type { Prisma, SdIntegration, SdIntegrationKind } from '@prisma/client'
import { auditAuth, auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import { BETTER_AUTH_URL } from '@/lib/env/server'
import {
  sdIntegrationNotConfigured,
  sdIntegrationNotFound,
  sdIntegrationRequestFailed,
  validationError,
} from '@/src/errors'
import { encryptConnectionSecret } from '@/src/lib/crypto'
import { err, ok, type Result } from '@/src/lib/result'
import { GithubClient } from '@/src/lib/servicedesk/github-client'
import {
  parseSdGithubConfig,
  parseSdGithubRepo,
  parseSdSlackConfig,
  SD_SLACK_CONFIG_DEFAULTS,
  type SdGithubConfig,
  type SdSlackConfig,
  sdGithubRepoKey,
} from '@/src/lib/servicedesk/integrations'
import {
  getSlackAppConfig,
  SLACK_EVENTS_PATH,
  SlackClient,
  slackAuthorizeUrl,
} from '@/src/lib/servicedesk/slack-client'
import {
  createSdSlackOauthState,
  verifySdSlackOauthState,
} from '@/src/lib/servicedesk/slack-oauth-state'
import { toSdIntegrationDTO } from '@/src/mappers/sd-integration.mapper'
import { SdIntegrationRepository } from '@/src/repositories/sd-integration.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import type {
  ConnectSdGithubDTO,
  UpdateSdGithubConfigDTO,
  UpdateSdSlackConfigDTO,
} from '@/src/schemas/sd-integration.schema'
import type {
  SdIntegrationDTO,
  SdIntegrationsOverviewDTO,
  SdSlackChannelOptionDTO,
} from '@/types/sd-integration'
import { SdAccess } from './sd-access'
import { assertSdRefs, sdAdminMutation } from './sd-config-support'
import { decryptSdIntegrationToken } from './sd-integration-credentials'

/**
 * Configuração das integrações do ServiceDesk — **só admin do módulo**
 * (`SdAccess.requireAdmin`, recurso `sd-integrations`).
 *
 * - **Slack**: conexão por OAuth do app do Slack. O token do bot é cifrado
 *   com `CONNECTION_SECRETS` e nunca volta em DTO, log ou resposta de API;
 *   sem `SLACK_CLIENT_ID`/`SECRET`/`SIGNING_SECRET` no servidor a integração
 *   fica inerte e responde `SD_INTEGRATION_NOT_CONFIGURED` explicando.
 * - **GitHub**: token do próprio workspace (PAT fine-grained ou token de um
 *   GitHub App já instalado) + o segredo do webhook do repositório, os dois
 *   cifrados. Conectar valida o acesso ao repositório antes de guardar.
 */

/** Caminho público do webhook do GitHub (igual para todos os workspaces). */
export const SD_GITHUB_WEBHOOK_PATH = '/api/servicedesk/integrations/github'

function githubWebhookUrl(): string {
  return `${BETTER_AUTH_URL.replace(/\/$/, '')}${SD_GITHUB_WEBHOOK_PATH}`
}

function slackEventsUrl(): string | null {
  return getSlackAppConfig()
    ? `${BETTER_AUTH_URL.replace(/\/$/, '')}${SLACK_EVENTS_PATH}`
    : null
}

/** Merge do `config` do Slack com o que o admin mandou. */
function mergeSlackConfig(
  current: SdSlackConfig,
  dto: UpdateSdSlackConfigDTO,
): SdSlackConfig {
  return {
    channels: dto.channels ?? current.channels,
    events: dto.events ? [...new Set(dto.events)] : current.events,
    allowTicketFromMessage:
      dto.allowTicketFromMessage ?? current.allowTicketFromMessage,
    mirrorThreadReplies: dto.mirrorThreadReplies ?? current.mirrorThreadReplies,
    ticketType: dto.ticketType ?? current.ticketType,
    departmentId:
      dto.departmentId === undefined ? current.departmentId : dto.departmentId,
  }
}

function mergeGithubConfig(
  current: SdGithubConfig,
  dto: UpdateSdGithubConfigDTO,
): SdGithubConfig {
  return {
    suggestPhaseOnClose: dto.suggestPhaseOnClose ?? current.suggestPhaseOnClose,
    allowIssueFromTicket:
      dto.allowIssueFromTicket ?? current.allowIssueFromTicket,
  }
}

function asJson(config: SdSlackConfig | SdGithubConfig): Prisma.InputJsonValue {
  return config as unknown as Prisma.InputJsonValue
}

export const SdIntegrationService = {
  /** Estado da aba Integrações: o que está conectado e as URLs a cadastrar. */
  async overview(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<SdIntegrationsOverviewDTO>> {
    const ctx = await SdAccess.requireAdmin(actorId, workspaceId)
    if (!ctx.ok) return ctx

    const rows = await SdIntegrationRepository.list(workspaceId)
    if (!rows.ok) return rows

    const byKind = (kind: SdIntegrationKind): SdIntegrationDTO | null => {
      const found = rows.value.find((row) => row.kind === kind)
      return found ? toSdIntegrationDTO(found) : null
    }

    return ok({
      slackConfigured: getSlackAppConfig() !== null,
      slackEventsUrl: slackEventsUrl(),
      githubWebhookUrl: githubWebhookUrl(),
      slack: byKind('SLACK'),
      github: byKind('GITHUB'),
    })
  },

  /* ---------------------------------- Slack ---------------------------------- */

  /** URL da tela de autorização do Slack (o workspace viaja no `state`). */
  async beginSlackConnect(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<{ authorizeUrl: string }>> {
    const ctx = await SdAccess.requireAdmin(actorId, workspaceId)
    if (!ctx.ok) return ctx

    const app = getSlackAppConfig()
    if (!app) {
      return err(
        sdIntegrationNotConfigured(
          'O app do Slack não está configurado no servidor (SLACK_CLIENT_ID, SLACK_CLIENT_SECRET e SLACK_SIGNING_SECRET)',
        ),
      )
    }

    const workspace = await SdTicketContextRepository.findWorkspace(workspaceId)
    if (!workspace.ok) return workspace
    if (!workspace.value) return err(sdIntegrationNotFound())

    const state = createSdSlackOauthState(workspaceId, workspace.value.slug)
    return ok({ authorizeUrl: slackAuthorizeUrl(app, state) })
  },

  /**
   * Fecha o OAuth: valida o `state`, troca o `code` pelo token do bot e
   * guarda a integração cifrada. A concessão é auditada em `auditAuth`
   * (é uma autorização de acesso a outro sistema) e em `auditMutation`.
   */
  async completeSlackConnect(
    actorId: string,
    state: string,
    code: string,
  ): Promise<Result<{ workspaceSlug: string; teamName: string | null }>> {
    const app = getSlackAppConfig()
    if (!app) return err(sdIntegrationNotConfigured())

    const parsed = verifySdSlackOauthState(state)
    if (!parsed.ok) {
      auditAuth({
        event: 'auth.oauth_grant.servicedesk_slack',
        userId: actorId,
        outcome: 'failure',
        reason: 'STATE_INVALID',
      })
      return err(validationError('Pedido de conexão inválido ou expirado'))
    }
    const { workspaceId, slug } = parsed.value

    const ctx = await SdAccess.requireAdmin(actorId, workspaceId)
    if (!ctx.ok) return ctx

    const exchanged = await SlackClient.exchangeCode(app, code)
    if (!exchanged.ok) {
      auditAuth({
        event: 'auth.oauth_grant.servicedesk_slack',
        userId: actorId,
        outcome: 'failure',
        reason: exchanged.error.code,
        meta: { workspaceId },
      })
      return exchanged
    }

    const current = await SdIntegrationRepository.findByKind(
      workspaceId,
      'SLACK',
    )
    if (!current.ok) return current
    const config = current.value
      ? parseSdSlackConfig(current.value.config)
      : SD_SLACK_CONFIG_DEFAULTS

    const encryptedToken = await encryptConnectionSecret(
      exchanged.value.accessToken,
    )
    const saved = await SdIntegrationRepository.upsert(
      workspaceId,
      'SLACK',
      exchanged.value.teamId,
      {
        externalName: exchanged.value.teamName,
        encryptedToken,
        config: asJson(config),
        createdById: actorId,
        status: 'ACTIVE',
        statusError: null,
      },
    )
    if (!saved.ok) return saved

    auditAuth({
      event: 'auth.oauth_grant.servicedesk_slack',
      userId: actorId,
      meta: { workspaceId, teamId: exchanged.value.teamId },
    })
    auditMutation({
      entity: 'sd_integration',
      action: 'connect',
      actorId,
      targetId: saved.value.id,
      meta: { workspaceId, kind: 'SLACK', teamId: exchanged.value.teamId },
    })

    return ok({ workspaceSlug: slug, teamName: exchanged.value.teamName })
  },

  /** Canais que o bot enxerga, para o seletor de canal por time. */
  async listSlackChannels(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<SdSlackChannelOptionDTO[]>> {
    const ctx = await SdAccess.requireAdmin(actorId, workspaceId)
    if (!ctx.ok) return ctx

    const integration = await SdIntegrationRepository.requireByKind(
      workspaceId,
      'SLACK',
    )
    if (!integration.ok) return integration

    const token = await decryptSdIntegrationToken(integration.value)
    if (!token.ok) return token

    const channels = await SlackClient.listChannels(token.value)
    if (!channels.ok) {
      await SdIntegrationRepository.markError(
        integration.value.id,
        channels.error.message,
      )
      return channels
    }
    return ok(channels.value)
  },

  /** Canal por time, eventos enviados e os dois interruptores do Slack. */
  async updateSlackConfig(
    actorId: string,
    workspaceId: string,
    dto: UpdateSdSlackConfigDTO,
  ): Promise<Result<SdIntegrationDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_integration',
      action: 'update',
      meta: { kind: 'SLACK', fields: Object.keys(dto) },
      targetId: (value) => value.id,
      run: async () => {
        const integration = await SdIntegrationRepository.requireByKind(
          workspaceId,
          'SLACK',
        )
        if (!integration.ok) return integration

        const refs = await assertSdRefs(workspaceId, {
          departmentIds: [
            dto.departmentId,
            ...(dto.channels ?? []).map((c) => c.departmentId),
          ],
        })
        if (!refs.ok) return refs

        const merged = mergeSlackConfig(
          parseSdSlackConfig(integration.value.config),
          dto,
        )
        const updated = await SdIntegrationRepository.update(
          integration.value.id,
          workspaceId,
          { config: asJson(merged) },
        )
        if (!updated.ok) return updated
        return ok(toSdIntegrationDTO(updated.value))
      },
    })
  },

  /* ---------------------------------- GitHub ---------------------------------- */

  /** Conecta o repositório: valida o acesso com o token antes de guardar. */
  async connectGithub(
    actorId: string,
    workspaceId: string,
    dto: ConnectSdGithubDTO,
  ): Promise<Result<SdIntegrationDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_integration',
      action: 'connect',
      meta: { kind: 'GITHUB', repo: dto.repo },
      targetId: (value) => value.id,
      run: async () => {
        const ref = parseSdGithubRepo(dto.repo)
        if (!ref) {
          return err(
            validationError(
              'Repositório inválido — use `owner/repo` ou a URL do GitHub',
            ),
          )
        }

        const check = await GithubClient.checkRepo(dto.token, ref)
        if (!check.ok) return check
        // `externalId` é o nome canônico que o GitHub devolve: é com ele que
        // o `repository.full_name` do webhook vai casar.
        const canonical = parseSdGithubRepo(check.value.fullName) ?? ref

        const [encryptedToken, encryptedSigningSecret] = await Promise.all([
          encryptConnectionSecret(dto.token),
          dto.webhookSecret
            ? encryptConnectionSecret(dto.webhookSecret)
            : Promise.resolve(null),
        ])

        const saved = await SdIntegrationRepository.upsert(
          workspaceId,
          'GITHUB',
          sdGithubRepoKey(canonical),
          {
            externalName: check.value.fullName,
            encryptedToken,
            encryptedSigningSecret,
            config: asJson({
              suggestPhaseOnClose: dto.suggestPhaseOnClose,
              allowIssueFromTicket: dto.allowIssueFromTicket,
            }),
            createdById: actorId,
            status: 'ACTIVE',
            statusError: null,
          },
        )
        if (!saved.ok) return saved
        return ok(toSdIntegrationDTO(saved.value))
      },
    })
  },

  /** Troca o token/segredo (o anterior é descartado) e os interruptores. */
  async updateGithub(
    actorId: string,
    workspaceId: string,
    dto: UpdateSdGithubConfigDTO,
  ): Promise<Result<SdIntegrationDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_integration',
      action: 'update',
      meta: {
        kind: 'GITHUB',
        // Só os nomes dos campos: nunca o token nem o segredo.
        fields: Object.keys(dto),
      },
      targetId: (value) => value.id,
      run: async () => {
        const integration = await SdIntegrationRepository.requireByKind(
          workspaceId,
          'GITHUB',
        )
        if (!integration.ok) return integration

        const data: Parameters<typeof SdIntegrationRepository.update>[2] = {
          config: asJson(
            mergeGithubConfig(
              parseSdGithubConfig(integration.value.config),
              dto,
            ),
          ),
        }

        if (dto.token !== undefined) {
          const ref = parseSdGithubRepo(integration.value.externalId)
          if (!ref) return err(sdIntegrationRequestFailed())
          const check = await GithubClient.checkRepo(dto.token, ref)
          if (!check.ok) return check
          data.encryptedToken = await encryptConnectionSecret(dto.token)
          data.status = 'ACTIVE'
          data.statusError = null
        }
        if (dto.webhookSecret !== undefined) {
          data.encryptedSigningSecret = dto.webhookSecret
            ? await encryptConnectionSecret(dto.webhookSecret)
            : null
        }

        const updated = await SdIntegrationRepository.update(
          integration.value.id,
          workspaceId,
          data,
        )
        if (!updated.ok) return updated
        return ok(toSdIntegrationDTO(updated.value))
      },
    })
  },

  /* -------------------------------- desconectar -------------------------------- */

  /**
   * Desconecta: a integração sai da aba, o token é apagado e o webhook
   * deixa de ser aceito. Os vínculos já registrados ficam no histórico do
   * chamado.
   */
  async disconnect(
    actorId: string,
    workspaceId: string,
    kind: SdIntegrationKind,
  ): Promise<Result<void>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_integration',
      action: 'disconnect',
      meta: { kind },
      run: async () => {
        const integration = await SdIntegrationRepository.requireByKind(
          workspaceId,
          kind,
        )
        if (!integration.ok) return integration
        const removed = await SdIntegrationRepository.disconnect(
          integration.value.id,
          workspaceId,
        )
        if (!removed.ok) return removed
        logger.info('servicedesk.integration.disconnected', {
          workspaceId,
          kind,
          integrationId: integration.value.id,
        })
        return ok(undefined)
      },
    })
  },
}

/** Integração ativa do tipo, para os fluxos sem usuário (worker/webhook). */
export async function activeSdIntegration(
  workspaceId: string,
  kind: SdIntegrationKind,
): Promise<SdIntegration | null> {
  const found = await SdIntegrationRepository.findByKind(workspaceId, kind)
  if (!found.ok || !found.value) return null
  return found.value.status === 'DISCONNECTED' ? null : found.value
}
