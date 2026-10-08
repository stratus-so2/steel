import type {
  Prisma,
  WorkspaceIntegration,
  WorkspaceIntegrationKind,
} from '@prisma/client'
import type { RepoIntegrationKind } from '@/src/lib/integrations/catalog'
import {
  parseWorkspaceRepoConfig,
  parseWorkspaceSlackConfig,
  type SdSlackModuleConfig,
} from '@/src/lib/integrations/config'
import { ok, type Result } from '@/src/lib/result'
import {
  getSlackAppConfig,
  SlackClient,
} from '@/src/lib/servicedesk/slack-client'
import { toSdIntegrationDTO } from '@/src/mappers/sd-integration.mapper'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { WorkspaceIntegrationRepository } from '@/src/repositories/workspace-integration.repository'
import type {
  UpdateSdRepoConfigDTO,
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
 * ServiceDesk settings of the integrations — **module admins only**
 * (`SdAccess.requireAdmin`).
 *
 * The connections (Slack OAuth, GitHub/GitLab token and webhook secret) and
 * the Slack notification rules are workspace-level since ADR 0024 and are
 * managed in Ajustes > Integrações by OWNER/ADMIN. What stays here is what
 * only the ServiceDesk knows about: the Slack channel per team, ticket from
 * a Slack message, thread mirroring, and — per repository provider — the
 * phase suggestion and "open issue from the ticket".
 */

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

function mergeSlackModule(
  current: SdSlackModuleConfig,
  dto: UpdateSdSlackConfigDTO,
): SdSlackModuleConfig {
  return {
    channels: dto.channels ?? current.channels,
    allowTicketFromMessage:
      dto.allowTicketFromMessage ?? current.allowTicketFromMessage,
    mirrorThreadReplies: dto.mirrorThreadReplies ?? current.mirrorThreadReplies,
    ticketType: dto.ticketType ?? current.ticketType,
    departmentId:
      dto.departmentId === undefined ? current.departmentId : dto.departmentId,
  }
}

export const SdIntegrationService = {
  /** Integrations tab: connection state and the module settings. */
  async overview(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<SdIntegrationsOverviewDTO>> {
    const ctx = await SdAccess.requireAdmin(actorId, workspaceId)
    if (!ctx.ok) return ctx

    const rows = await WorkspaceIntegrationRepository.list(workspaceId)
    if (!rows.ok) return rows

    const byKind = (
      kind: WorkspaceIntegrationKind,
    ): SdIntegrationDTO | null => {
      const found = rows.value.find((row) => row.kind === kind)
      return found ? toSdIntegrationDTO(found) : null
    }
    const workspace = await SdTicketContextRepository.findWorkspace(workspaceId)
    const slug = workspace.ok ? (workspace.value?.slug ?? null) : null

    return ok({
      slackConfigured: getSlackAppConfig() !== null,
      manageHref: slug ? `/${slug}/settings/integrations` : null,
      slack: byKind('SLACK'),
      github: byKind('GITHUB'),
      gitlab: byKind('GITLAB'),
    })
  },

  /** Channels the bot sees, for the team-channel selector. */
  async listSlackChannels(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<SdSlackChannelOptionDTO[]>> {
    const ctx = await SdAccess.requireAdmin(actorId, workspaceId)
    if (!ctx.ok) return ctx

    const integration = await WorkspaceIntegrationRepository.requireByKind(
      workspaceId,
      'SLACK',
    )
    if (!integration.ok) return integration

    const token = await decryptSdIntegrationToken(integration.value)
    if (!token.ok) return token

    const channels = await SlackClient.listChannels(token.value)
    if (!channels.ok) {
      await WorkspaceIntegrationRepository.markError(
        integration.value.id,
        channels.error.message,
      )
      return channels
    }
    return ok(channels.value)
  },

  /** Team channels, ticket from a Slack message and thread mirroring. */
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
        const integration = await WorkspaceIntegrationRepository.requireByKind(
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

        const config = parseWorkspaceSlackConfig(integration.value.config)
        const next = {
          routes: config.routes,
          waitingMinutes: config.waitingMinutes,
          servicedesk: mergeSlackModule(config.servicedesk, dto),
        }
        return save(integration.value, workspaceId, next)
      },
    })
  },

  /** Phase suggestion and "open issue from the ticket" (GitHub or GitLab). */
  async updateRepoConfig(
    actorId: string,
    workspaceId: string,
    kind: RepoIntegrationKind,
    dto: UpdateSdRepoConfigDTO,
  ): Promise<Result<SdIntegrationDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_integration',
      action: 'update',
      meta: { kind, fields: Object.keys(dto) },
      targetId: (value) => value.id,
      run: async () => {
        const integration = await WorkspaceIntegrationRepository.requireByKind(
          workspaceId,
          kind,
        )
        if (!integration.ok) return integration

        const current = parseWorkspaceRepoConfig(integration.value.config)
        const next = {
          servicedesk: {
            suggestPhaseOnClose:
              dto.suggestPhaseOnClose ??
              current.servicedesk.suggestPhaseOnClose,
            allowIssueFromTicket:
              dto.allowIssueFromTicket ??
              current.servicedesk.allowIssueFromTicket,
          },
        }
        return save(integration.value, workspaceId, next)
      },
    })
  },
}

async function save(
  integration: WorkspaceIntegration,
  workspaceId: string,
  config: unknown,
): Promise<Result<SdIntegrationDTO>> {
  const updated = await WorkspaceIntegrationRepository.update(
    integration.id,
    workspaceId,
    { config: asJson(config) },
  )
  if (!updated.ok) return updated
  return ok(toSdIntegrationDTO(updated.value))
}
