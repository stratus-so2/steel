import type { SdIntegrationLink, WorkspaceIntegration } from '@prisma/client'
import { logger } from '@/lib/axiom/logger'
import { SdIntegrationEventCache } from '@/src/cache/sd-integration-event.cache'
import {
  sdIntegrationNotConfigured,
  sdIntegrationSignatureInvalid,
  validationError,
} from '@/src/errors'
import { parseWorkspaceRepoConfig } from '@/src/lib/integrations/config'
import { parseGitlabLinkKey } from '@/src/lib/integrations/gitlab'
import { RepoProvider, repoTarget } from '@/src/lib/integrations/repo-provider'
import { err, ok, type Result } from '@/src/lib/result'
import {
  parseSdGithubRepo,
  SD_GITHUB_STATE_LABEL,
  type SdGithubExternalState,
  type SdRepoRefKind,
  sdGithubLinkKey,
  sdGithubRepoKey,
  sdGithubState,
  sdGithubStateChangeBody,
  sdRepoItemNoun,
  verifyGithubSignature,
} from '@/src/lib/servicedesk/integrations'
import { SdIntegrationRepository } from '@/src/repositories/sd-integration.repository'
import { WorkspaceIntegrationRepository } from '@/src/repositories/workspace-integration.repository'
import { assertModuleEnabled } from './authz'
import {
  decryptSdIntegrationSecret,
  decryptSdIntegrationToken,
} from './sd-integration-credentials'
import { recordSdTicketEvent } from './sd-ticket-event-recorder'
import { notifySdTicketReply } from './sd-ticket-reply-notify'

/**
 * Public GitHub entry (`POST /api/integrations/github/webhook`, and the
 * legacy `/api/servicedesk/integrations/github`): mirrors the state of the
 * issue/PR linked to a ticket.
 *
 * The repository (`repository.full_name`) is only read to **find** the
 * workspace connection(s) and their secrets; nothing is written before the
 * HMAC (`X-Hub-Signature-256`, constant-time) closes over the raw body. When
 * several workspaces connected the same repository, the one whose secret
 * verifies wins. Idempotent by `X-GitHub-Delivery` — GitHub redelivers.
 *
 * Closing or merging the item **suggests** the phase change: it records the
 * event and a message in the ticket, but the agent moves the phase.
 */

const ACTIONS = new Set(['closed', 'reopened', 'merged'])

export type SdGithubWebhookOutcome =
  | 'state_updated'
  | 'duplicate'
  | 'ignored'
  | 'unlinked'

export interface SdGithubWebhookResult {
  outcome: SdGithubWebhookOutcome
  state?: SdGithubExternalState
}

export interface SdGithubWebhookInput {
  rawBody: string
  signature: string | null
  event: string | null
  deliveryId: string | null
}

interface GithubWebhookBody {
  action?: string
  repository?: { full_name?: string }
  issue?: {
    number?: number
    title?: string
    state?: string
    html_url?: string
  }
  pull_request?: {
    number?: number
    title?: string
    state?: string
    html_url?: string
    merged?: boolean
    merged_at?: string | null
  }
}

function parseBody(rawBody: string): GithubWebhookBody | null {
  try {
    const parsed: unknown = JSON.parse(rawBody)
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as GithubWebhookBody)
      : null
  } catch {
    return null
  }
}

/**
 * Picks, among the live connections of the repository/project, the one whose
 * webhook secret verifies the request. `null` = none verifies; a connection
 * without a secret never matches.
 */
export async function verifiedIntegration(
  candidates: WorkspaceIntegration[],
  verify: (secret: string) => boolean,
): Promise<{ integration: WorkspaceIntegration | null; withSecret: number }> {
  let withSecret = 0
  for (const candidate of candidates) {
    if (candidate.status === 'DISCONNECTED') continue
    const secret = await decryptSdIntegrationSecret(candidate)
    if (!secret.ok || !secret.value) continue
    withSecret += 1
    if (verify(secret.value)) return { integration: candidate, withSecret }
  }
  return { integration: null, withSecret }
}

/**
 * Updates the link and records the mirroring in the ticket. Shared by the
 * GitHub and GitLab webhooks and the hourly reconciliation.
 */
export async function applySdGithubState(input: {
  integration: WorkspaceIntegration
  link: SdIntegrationLink
  state: SdGithubExternalState
  kind: SdRepoRefKind
  title?: string | null
  url?: string | null
  via: 'webhook' | 'sync'
}): Promise<Result<boolean>> {
  const { integration, link, state } = input
  if (link.externalState === state) return ok(false)

  const updated = await SdIntegrationRepository.updateLink(link.id, {
    externalState: state,
    ...(input.url ? { externalUrl: input.url } : {}),
    ...(input.title ? { meta: { title: input.title } } : {}),
  })
  if (!updated.ok) return updated

  const config = parseWorkspaceRepoConfig(integration.config).servicedesk
  await recordSdTicketEvent({
    workspaceId: integration.workspaceId,
    ticketId: link.ticketId,
    actorKind: 'SYSTEM',
    actorUserId: null,
    action: 'integration.github_state',
    field: 'externalState',
    fromValue: link.externalState,
    toValue: state,
    meta: {
      externalKey: link.externalKey,
      kind: input.kind,
      provider: integration.kind,
      via: input.via,
      suggestPhase: config.suggestPhaseOnClose && state !== 'open',
    },
  })

  const message = await SdIntegrationRepository.createTicketMessage({
    workspaceId: integration.workspaceId,
    ticketId: link.ticketId,
    authorKind: 'SYSTEM',
    authorUserId: null,
    body: sdGithubStateChangeBody({
      kind: input.kind,
      key: link.externalKey,
      url: input.url ?? link.externalUrl,
      state,
      suggestPhase: config.suggestPhaseOnClose,
    }),
  })
  if (!message.ok) {
    logger.warn('servicedesk.github.state_message_failed', {
      workspaceId: integration.workspaceId,
      ticketId: link.ticketId,
      reason: message.error.code,
    })
  } else {
    const what = sdRepoItemNoun(input.kind).replace(/^(A|O) /, '')
    await notifySdTicketReply({
      workspaceId: integration.workspaceId,
      ticket: { id: link.ticketId },
      channel: integration.kind === 'GITLAB' ? 'GITLAB' : 'GITHUB',
      body: `${what[0].toUpperCase()}${what.slice(1)} ${link.externalKey}: ${SD_GITHUB_STATE_LABEL[state].toLowerCase()}`,
    })
  }

  logger.info('servicedesk.github.state_mirrored', {
    workspaceId: integration.workspaceId,
    ticketId: link.ticketId,
    externalKey: link.externalKey,
    state,
    via: input.via,
  })
  return ok(true)
}

export const SdGithubWebhookService = {
  async handle(
    input: SdGithubWebhookInput,
  ): Promise<Result<SdGithubWebhookResult>> {
    if (input.event === 'ping') return ok({ outcome: 'ignored' })
    if (input.event !== 'issues' && input.event !== 'pull_request') {
      return ok({ outcome: 'ignored' })
    }

    const body = parseBody(input.rawBody)
    if (!body) return err(validationError('Corpo do GitHub inválido'))

    const fullName = body.repository?.full_name
    const repo = fullName ? parseSdGithubRepo(fullName) : null
    if (!repo) return err(validationError('Repositório ausente no payload'))

    // Lookup before verification: the repository name only finds the
    // secrets. Nothing about the ticket is read or written before the HMAC.
    const found = await WorkspaceIntegrationRepository.findManyByExternalId(
      'GITHUB',
      sdGithubRepoKey(repo),
    )
    if (!found.ok) return found
    const live = found.value.filter((row) => row.status !== 'DISCONNECTED')
    if (live.length === 0) {
      return err(
        sdIntegrationNotConfigured(
          'Este repositório não está conectado a nenhum workspace',
        ),
      )
    }

    const { integration, withSecret } = await verifiedIntegration(
      live,
      (secret) =>
        verifyGithubSignature({
          secret,
          signature: input.signature,
          rawBody: input.rawBody,
        }),
    )
    if (!integration) {
      if (withSecret === 0) {
        return err(
          sdIntegrationNotConfigured(
            'A integração do GitHub está sem segredo de webhook configurado',
          ),
        )
      }
      return err(sdIntegrationSignatureInvalid('Assinatura do GitHub inválida'))
    }

    await WorkspaceIntegrationRepository.markEvent(
      integration.id,
      `github:${input.event}${body.action ? `.${body.action}` : ''}`,
    )

    const enabled = await assertModuleEnabled(
      integration.workspaceId,
      'SERVICE_DESK',
    )
    if (!enabled.ok) return enabled

    if (!body.action || !ACTIONS.has(body.action)) {
      return ok({ outcome: 'ignored' })
    }

    const item = body.issue ?? body.pull_request
    const number = item?.number
    if (!number) return ok({ outcome: 'ignored' })

    const delivery = input.deliveryId ?? `${fullName}:${number}:${body.action}`
    const first = await SdIntegrationEventCache.claim('github', delivery)
    if (!first) return ok({ outcome: 'duplicate' })

    const externalKey = sdGithubLinkKey(repo, number)
    const link = await SdIntegrationRepository.findRepoLinkByKey(
      integration.id,
      'GITHUB',
      externalKey,
    )
    if (!link.ok) {
      await SdIntegrationEventCache.release('github', delivery)
      return link
    }
    if (!link.value) return ok({ outcome: 'unlinked' })

    const state = sdGithubState({
      state: item?.state ?? null,
      merged: body.pull_request?.merged ?? null,
      merged_at: body.pull_request?.merged_at ?? null,
    })
    const applied = await applySdGithubState({
      integration,
      link: link.value,
      state,
      kind: body.pull_request ? 'GITHUB_PULL_REQUEST' : 'GITHUB_ISSUE',
      title: item?.title ?? null,
      url: item?.html_url ?? null,
      via: 'webhook',
    })
    if (!applied.ok) {
      await SdIntegrationEventCache.release('github', delivery)
      return applied
    }
    return ok({ outcome: applied.value ? 'state_updated' : 'ignored', state })
  },
}

export interface SdGithubSyncResult {
  checked: number
  updated: number
  failed: number
}

/** How many links the hourly reconciliation looks at per round. */
const SYNC_BATCH = 200

/** Item number and kind of a link, from its key. */
function linkRef(
  link: SdIntegrationLink,
): { number: number; kind: SdRepoRefKind | null } | null {
  if (link.kind === 'GITLAB_ISSUE' || link.kind === 'GITLAB_MERGE_REQUEST') {
    const parsed = parseGitlabLinkKey(link.externalKey)
    return parsed ? { number: parsed.iid, kind: parsed.kind } : null
  }
  const number = Number(link.externalKey.split('#')[1])
  return Number.isInteger(number) && number > 0 ? { number, kind: null } : null
}

/**
 * Hourly reconciliation (`sync-github-state`): checks on the API the state
 * of the GitHub/GitLab items linked to open tickets. It exists for a lost
 * webhook — the outcome is the same as the webhook's.
 */
export const SdGithubSyncService = {
  async runTick(workspaceId?: string): Promise<Result<SdGithubSyncResult>> {
    const links = await SdIntegrationRepository.listRepoLinksToSync(
      SYNC_BATCH,
      workspaceId,
    )
    if (!links.ok) return links

    const result: SdGithubSyncResult = {
      checked: links.value.length,
      updated: 0,
      failed: 0,
    }
    const tokens = new Map<string, string | null>()

    for (const link of links.value) {
      const { integration } = link
      const target = repoTarget(integration)
      const ref = linkRef(link)
      if (!target || !ref) {
        result.failed += 1
        continue
      }

      if (!tokens.has(integration.id)) {
        const decrypted = await decryptSdIntegrationToken(integration)
        tokens.set(integration.id, decrypted.ok ? decrypted.value : null)
      }
      const token = tokens.get(integration.id) ?? null
      if (!token) {
        result.failed += 1
        continue
      }

      const item = await RepoProvider.getItem(target, token, {
        project: null,
        number: ref.number,
        kind: ref.kind,
      })
      if (!item.ok) {
        result.failed += 1
        continue
      }

      const applied = await applySdGithubState({
        integration,
        link,
        state: item.value.state,
        kind: item.value.kind,
        title: item.value.title,
        url: item.value.url,
        via: 'sync',
      })
      if (!applied.ok) result.failed += 1
      else if (applied.value) result.updated += 1
    }

    logger.info('servicedesk.github.sync_completed', {
      component: 'Worker',
      ...result,
    })
    return ok(result)
  },
}
