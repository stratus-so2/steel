import type { WorkspaceIntegration } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { NEXT_PUBLIC_URL } from '@/lib/env/env'
import {
  sdIntegrationLinkExists,
  sdIntegrationNotFound,
  validationError,
} from '@/src/errors'
import type { RepoIntegrationKind } from '@/src/lib/integrations/catalog'
import { parseWorkspaceRepoConfig } from '@/src/lib/integrations/config'
import {
  inferRepoProvider,
  isForeignRef,
  parseRepoRef,
  REPO_PROVIDER_LABEL,
  RepoProvider,
  type RepoTarget,
  repoTarget,
} from '@/src/lib/integrations/repo-provider'
import { err, ok, type Result } from '@/src/lib/result'
import { sdHtmlToText } from '@/src/lib/servicedesk/html'
import { sdGithubIssueFromTicket } from '@/src/lib/servicedesk/integrations'
import { sdTicketNotificationHref } from '@/src/lib/servicedesk/notify'
import { toSdIntegrationLinkDTO } from '@/src/mappers/sd-integration.mapper'
import { SdIntegrationRepository } from '@/src/repositories/sd-integration.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { WorkspaceIntegrationRepository } from '@/src/repositories/workspace-integration.repository'
import type {
  CreateSdGithubIssueDTO,
  LinkSdGithubItemDTO,
} from '@/src/schemas/sd-integration.schema'
import type {
  SdIntegrationLinkDTO,
  SdRepoProviderOptionDTO,
} from '@/types/sd-integration'
import { decryptSdIntegrationToken } from './sd-integration-credentials'
import { recordSdTicketEvent } from './sd-ticket-event-recorder'
import { loadSdTicketTab, publishSdTicketTab } from './sd-ticket-tab-support'

/**
 * Ticket ↔ Slack/GitHub/GitLab links seen from the ticket screen: list, link
 * an existing issue/PR/MR, open an issue from the ticket and unlink. The
 * GitHub and GitLab connections are workspace-level (ADR 0024) and offer the
 * same capability set.
 *
 * Authorization through the same base as the other tabs (`loadSdTicketTab`,
 * resource `sd-tickets`): only **agents** touch the links; the requester
 * does not see the block. Every mutation records a traceability event
 * (`SdTicketEvent`) and `auditMutation`.
 */

/** ITIL types where opening/linking an issue makes sense. */
const REPO_TICKET_TYPES = new Set(['PROBLEM', 'CHANGE'])

async function repoIntegration(
  workspaceId: string,
  provider: RepoIntegrationKind,
): Promise<Result<{ integration: WorkspaceIntegration; target: RepoTarget }>> {
  const found = await WorkspaceIntegrationRepository.requireByKind(
    workspaceId,
    provider,
  )
  if (!found.ok) return found
  const target = repoTarget(found.value)
  if (!target) return err(sdIntegrationNotFound())
  return ok({ integration: found.value, target })
}

/**
 * Provider of a reference: explicit > inferred from its shape > the only
 * connected repository provider > GitHub.
 */
async function resolveProvider(
  workspaceId: string,
  dto: LinkSdGithubItemDTO,
): Promise<RepoIntegrationKind> {
  if (dto.provider) return dto.provider
  const inferred = inferRepoProvider(dto.ref)
  if (inferred) return inferred
  const rows = await WorkspaceIntegrationRepository.list(workspaceId)
  const kinds = rows.ok
    ? rows.value
        .map((row) => row.kind)
        .filter((kind): kind is RepoIntegrationKind => kind !== 'SLACK')
    : []
  return kinds.length === 1 ? kinds[0] : 'GITHUB'
}

function ticketUrl(slug: string | null, number: number): string {
  return slug
    ? `${NEXT_PUBLIC_URL}${sdTicketNotificationHref(slug, number)}`
    : NEXT_PUBLIC_URL
}

export const SdIntegrationLinkService = {
  /** Vínculos do chamado (thread do Slack, issues e PRs com o estado). */
  async list(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
  ): Promise<Result<SdIntegrationLinkDTO[]>> {
    const scope = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'VIEW',
      { agentOnly: true },
    )
    if (!scope.ok) return scope

    const rows = await SdIntegrationRepository.listLinks(
      workspaceId,
      scope.value.ticket.id,
    )
    if (!rows.ok) return rows
    return ok(rows.value.map(toSdIntegrationLinkDTO))
  },

  /**
   * Repository providers connected to the workspace, as seen from a ticket
   * (the agent picks where to link/open the issue). Same access as `list`.
   */
  async providers(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
  ): Promise<Result<SdRepoProviderOptionDTO[]>> {
    const scope = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'VIEW',
      { agentOnly: true },
    )
    if (!scope.ok) return scope

    const rows = await WorkspaceIntegrationRepository.list(workspaceId)
    if (!rows.ok) return rows
    const options: SdRepoProviderOptionDTO[] = []
    for (const kind of ['GITHUB', 'GITLAB'] as const) {
      const row = rows.value.find((item) => item.kind === kind)
      const target = row ? repoTarget(row) : null
      if (!row || !target || row.status === 'DISCONNECTED') continue
      options.push({
        provider: kind,
        project: target.project,
        allowIssueFromTicket: parseWorkspaceRepoConfig(row.config).servicedesk
          .allowIssueFromTicket,
      })
    }
    return ok(options)
  },

  /**
   * Links an existing item: `#42`, `!42` (GitLab MR), `owner/repo#42`,
   * `group/project!42` or the URL. The item kind and state come from the
   * provider API, not from the text typed.
   */
  async linkGithubItem(
    actorId: string,
    workspaceId: string,
    dto: LinkSdGithubItemDTO,
  ): Promise<Result<SdIntegrationLinkDTO>> {
    const scope = await loadSdTicketTab(
      actorId,
      workspaceId,
      dto.ticketId,
      'EDIT',
      { agentOnly: true, requireOpen: true },
    )
    if (!scope.ok) return scope

    const provider = await resolveProvider(workspaceId, dto)
    const parsed = parseRepoRef(provider, dto.ref)
    if (!parsed) {
      return err(
        validationError(
          provider === 'GITLAB'
            ? 'Informe o número (#42 para issue, !42 para merge request), `grupo/projeto#42` ou a URL'
            : 'Informe o número (#42), `owner/repo#42` ou a URL da issue/pull request',
        ),
      )
    }

    const repo = await repoIntegration(workspaceId, provider)
    if (!repo.ok) return repo
    const { integration, target } = repo.value

    // A reference of another repository is refused: the link belongs to the
    // connected repository (its webhooks are the ones that arrive).
    if (isForeignRef(target, parsed)) {
      return err(
        validationError(
          `A integração do ${REPO_PROVIDER_LABEL[provider]} está conectada a ${target.project} — vincule itens desse repositório`,
        ),
      )
    }

    const token = await decryptSdIntegrationToken(integration)
    if (!token.ok) return token

    const item = await RepoProvider.getItem(target, token.value, parsed)
    if (!item.ok) return item

    const existing = await SdIntegrationRepository.findRepoLinkByKey(
      integration.id,
      provider,
      item.value.key,
    )
    if (!existing.ok) return existing
    if (existing.value) {
      return err(
        sdIntegrationLinkExists(
          existing.value.ticketId === scope.value.ticket.id
            ? 'Este item já está vinculado a este chamado'
            : 'Este item já está vinculado a outro chamado',
        ),
      )
    }

    const created = await SdIntegrationRepository.createLink({
      workspaceId,
      integrationId: integration.id,
      ticketId: scope.value.ticket.id,
      kind: item.value.kind,
      externalKey: item.value.key,
      externalUrl: item.value.url,
      externalState: item.value.state,
      meta: { title: item.value.title },
      createdById: actorId,
    })
    if (!created.ok) return created

    await recordSdTicketEvent({
      workspaceId,
      ticketId: scope.value.ticket.id,
      actorKind: 'AGENT',
      actorUserId: actorId,
      action: 'integration.linked',
      toValue: { id: item.value.key, label: item.value.title },
      meta: { kind: item.value.kind, url: item.value.url },
    })
    auditMutation({
      entity: 'sd_integration_link',
      action: 'link',
      actorId,
      targetId: created.value.id,
      meta: {
        workspaceId,
        ticketId: scope.value.ticket.id,
        kind: item.value.kind,
        externalKey: item.value.key,
      },
    })
    await publishSdTicketTab(scope.value.ticket, 'ticket.updated', actorId)

    return ok(toSdIntegrationLinkDTO(created.value))
  },

  /**
   * Opens an issue in the connected repository/project from the ticket
   * (title, context and link). Problem and change only — the technical work
   * of an incident/request lives in the ticket itself.
   */
  async createGithubIssue(
    actorId: string,
    workspaceId: string,
    dto: CreateSdGithubIssueDTO,
    provider: RepoIntegrationKind = 'GITHUB',
  ): Promise<Result<SdIntegrationLinkDTO>> {
    const scope = await loadSdTicketTab(
      actorId,
      workspaceId,
      dto.ticketId,
      'EDIT',
      { agentOnly: true, requireOpen: true },
    )
    if (!scope.ok) return scope

    const { ticket, code } = scope.value
    if (!REPO_TICKET_TYPES.has(ticket.type)) {
      return err(
        validationError(
          'Abrir issue a partir do chamado vale para problema e mudança',
        ),
      )
    }

    const repo = await repoIntegration(workspaceId, provider)
    if (!repo.ok) return repo
    const { integration, target } = repo.value

    const config = parseWorkspaceRepoConfig(integration.config).servicedesk
    if (!config.allowIssueFromTicket) {
      return err(
        validationError(
          'Abrir issue a partir do chamado está desligado nas configurações',
        ),
      )
    }

    const token = await decryptSdIntegrationToken(integration)
    if (!token.ok) return token

    const workspace = await SdTicketContextRepository.findWorkspace(workspaceId)
    const slug = workspace.ok ? (workspace.value?.slug ?? null) : null
    const draft = sdGithubIssueFromTicket({
      ticketCode: code,
      ticketTitle: ticket.title,
      ticketUrl: ticketUrl(slug, ticket.number),
      description: ticket.description ? sdHtmlToText(ticket.description) : null,
      ticketType: ticket.type,
      priority: ticket.priority?.name ?? null,
    })

    const created = await RepoProvider.createIssue(target, token.value, {
      title: dto.title ?? draft.title,
      body: draft.body,
    })
    if (!created.ok) return created

    const link = await SdIntegrationRepository.createLink({
      workspaceId,
      integrationId: integration.id,
      ticketId: ticket.id,
      kind: created.value.kind,
      externalKey: created.value.key,
      externalUrl: created.value.url,
      externalState: created.value.state,
      meta: { title: created.value.title, createdFromTicket: true },
      createdById: actorId,
    })
    if (!link.ok) return link

    await recordSdTicketEvent({
      workspaceId,
      ticketId: ticket.id,
      actorKind: 'AGENT',
      actorUserId: actorId,
      action: 'integration.issue_created',
      toValue: { id: created.value.key, label: created.value.title },
      meta: { url: created.value.url, provider },
    })
    auditMutation({
      entity: 'sd_integration_link',
      action: 'create',
      actorId,
      targetId: link.value.id,
      meta: {
        workspaceId,
        ticketId: ticket.id,
        externalKey: created.value.key,
        provider,
      },
    })
    await publishSdTicketTab(ticket, 'ticket.updated', actorId)

    return ok(toSdIntegrationLinkDTO(link.value))
  },

  /** Desvincula (não mexe no item do GitHub nem na thread do Slack). */
  async remove(
    actorId: string,
    workspaceId: string,
    linkId: string,
  ): Promise<Result<void>> {
    const link = await SdIntegrationRepository.findLink(linkId, workspaceId)
    if (!link.ok) return link

    const scope = await loadSdTicketTab(
      actorId,
      workspaceId,
      link.value.ticketId,
      'EDIT',
      { agentOnly: true },
    )
    if (!scope.ok) return scope

    const removed = await SdIntegrationRepository.removeLink(
      linkId,
      workspaceId,
    )
    if (!removed.ok) return removed

    await recordSdTicketEvent({
      workspaceId,
      ticketId: link.value.ticketId,
      actorKind: 'AGENT',
      actorUserId: actorId,
      action: 'integration.unlinked',
      fromValue: { id: link.value.externalKey, label: link.value.externalKey },
      meta: { kind: link.value.kind },
    })
    auditMutation({
      entity: 'sd_integration_link',
      action: 'unlink',
      actorId,
      targetId: linkId,
      meta: {
        workspaceId,
        ticketId: link.value.ticketId,
        externalKey: link.value.externalKey,
      },
    })
    await publishSdTicketTab(scope.value.ticket, 'ticket.updated', actorId)

    return ok(undefined)
  },
}
