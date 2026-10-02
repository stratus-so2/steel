import type { SdIntegration } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { NEXT_PUBLIC_URL } from '@/lib/env/env'
import {
  sdIntegrationLinkExists,
  sdIntegrationNotFound,
  validationError,
} from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { GithubClient } from '@/src/lib/servicedesk/github-client'
import { sdHtmlToText } from '@/src/lib/servicedesk/html'
import {
  parseSdGithubConfig,
  parseSdGithubItemRef,
  parseSdGithubRepo,
  type SdGithubRepoRef,
  sdGithubIssueFromTicket,
  sdGithubLinkKey,
} from '@/src/lib/servicedesk/integrations'
import { sdTicketNotificationHref } from '@/src/lib/servicedesk/notify'
import { toSdIntegrationLinkDTO } from '@/src/mappers/sd-integration.mapper'
import { SdIntegrationRepository } from '@/src/repositories/sd-integration.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import type {
  CreateSdGithubIssueDTO,
  LinkSdGithubItemDTO,
} from '@/src/schemas/sd-integration.schema'
import type { SdIntegrationLinkDTO } from '@/types/sd-integration'
import { decryptSdIntegrationToken } from './sd-integration-credentials'
import { recordSdTicketEvent } from './sd-ticket-event-recorder'
import { loadSdTicketTab, publishSdTicketTab } from './sd-ticket-tab-support'

/**
 * Vínculos chamado ↔ Slack/GitHub vistos da tela do chamado: listar,
 * vincular uma issue/PR que já existe, abrir uma issue a partir do chamado e
 * desvincular.
 *
 * Autorização pela mesma base das outras abas (`loadSdTicketTab`, recurso
 * `sd-tickets`): só **agentes** mexem nos vínculos; o solicitante não vê o
 * bloco. Toda mutação gera evento de rastreabilidade (`SdTicketEvent`) e
 * `auditMutation`.
 */

/** Tipos ITIL em que abrir/vincular issue faz sentido. */
const GITHUB_TICKET_TYPES = new Set(['PROBLEM', 'CHANGE'])

async function githubIntegration(
  workspaceId: string,
): Promise<Result<{ integration: SdIntegration; ref: SdGithubRepoRef }>> {
  const found = await SdIntegrationRepository.requireByKind(
    workspaceId,
    'GITHUB',
  )
  if (!found.ok) return found
  const ref = parseSdGithubRepo(found.value.externalId)
  if (!ref) return err(sdIntegrationNotFound())
  return ok({ integration: found.value, ref })
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
   * Vincula uma issue/PR que já existe: aceita `#42`, `owner/repo#42` ou a
   * URL. O tipo (issue × pull request) e o estado vêm da API do GitHub, não
   * do texto informado.
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

    const parsed = parseSdGithubItemRef(dto.ref)
    if (!parsed) {
      return err(
        validationError(
          'Informe o número (#42), `owner/repo#42` ou a URL da issue/pull request',
        ),
      )
    }

    const github = await githubIntegration(workspaceId)
    if (!github.ok) return github
    const { integration, ref } = github.value

    // Referência de outro repositório não é aceita: o vínculo vale para o
    // repositório conectado (é dele que vêm os webhooks).
    if (
      parsed.owner &&
      parsed.repo &&
      (parsed.owner.toLowerCase() !== ref.owner.toLowerCase() ||
        parsed.repo.toLowerCase() !== ref.repo.toLowerCase())
    ) {
      return err(
        validationError(
          `A integração está conectada a ${ref.owner}/${ref.repo} — vincule itens desse repositório`,
        ),
      )
    }

    const token = await decryptSdIntegrationToken(integration)
    if (!token.ok) return token

    const item = await GithubClient.getItem(token.value, ref, parsed.number)
    if (!item.ok) return item

    const externalKey = sdGithubLinkKey(ref, item.value.number)
    const existing = await SdIntegrationRepository.findGithubLinkByKey(
      integration.id,
      externalKey,
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
      externalKey,
      externalUrl: item.value.htmlUrl,
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
      toValue: { id: externalKey, label: item.value.title },
      meta: { kind: item.value.kind, url: item.value.htmlUrl },
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
        externalKey,
      },
    })
    await publishSdTicketTab(scope.value.ticket, 'ticket.updated', actorId)

    return ok(toSdIntegrationLinkDTO(created.value))
  },

  /**
   * Abre uma issue no repositório conectado a partir do chamado (título,
   * contexto e link). Só para problema e mudança — o trabalho técnico de um
   * incidente/requisição vive no próprio chamado.
   */
  async createGithubIssue(
    actorId: string,
    workspaceId: string,
    dto: CreateSdGithubIssueDTO,
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
    if (!GITHUB_TICKET_TYPES.has(ticket.type)) {
      return err(
        validationError(
          'Abrir issue a partir do chamado vale para problema e mudança',
        ),
      )
    }

    const github = await githubIntegration(workspaceId)
    if (!github.ok) return github
    const { integration, ref } = github.value

    const config = parseSdGithubConfig(integration.config)
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

    const created = await GithubClient.createIssue(token.value, ref, {
      title: dto.title ?? draft.title,
      body: draft.body,
    })
    if (!created.ok) return created

    const externalKey = sdGithubLinkKey(ref, created.value.number)
    const link = await SdIntegrationRepository.createLink({
      workspaceId,
      integrationId: integration.id,
      ticketId: ticket.id,
      kind: created.value.kind,
      externalKey,
      externalUrl: created.value.htmlUrl,
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
      toValue: { id: externalKey, label: created.value.title },
      meta: { url: created.value.htmlUrl },
    })
    auditMutation({
      entity: 'sd_integration_link',
      action: 'create',
      actorId,
      targetId: link.value.id,
      meta: { workspaceId, ticketId: ticket.id, externalKey },
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
