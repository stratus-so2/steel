import type { SdIntegration, SdIntegrationLink } from '@prisma/client'
import { logger } from '@/lib/axiom/logger'
import { SdIntegrationEventCache } from '@/src/cache/sd-integration-event.cache'
import {
  sdIntegrationNotConfigured,
  sdIntegrationSignatureInvalid,
  validationError,
} from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { GithubClient } from '@/src/lib/servicedesk/github-client'
import {
  parseSdGithubConfig,
  parseSdGithubRepo,
  type SdGithubExternalState,
  type SdGithubRefKind,
  sdGithubLinkKey,
  sdGithubRepoKey,
  sdGithubState,
  sdGithubStateChangeBody,
  verifyGithubSignature,
} from '@/src/lib/servicedesk/integrations'
import { SdIntegrationRepository } from '@/src/repositories/sd-integration.repository'
import { assertModuleEnabled } from './authz'
import {
  decryptSdIntegrationSecret,
  decryptSdIntegrationToken,
} from './sd-integration-credentials'
import { recordSdTicketEvent } from './sd-ticket-event-recorder'

/**
 * Entrada pública do GitHub (`POST /api/servicedesk/integrations/github`):
 * espelha o estado da issue/PR vinculada ao chamado.
 *
 * O repositório (`repository.full_name`) só é lido para **descobrir** a
 * integração e o segredo; nada é gravado antes de o HMAC
 * (`X-Hub-Signature-256`, comparação em tempo constante) fechar sobre o
 * corpo bruto. Idempotente por `X-GitHub-Delivery` — o GitHub reentrega.
 *
 * Fechar ou mesclar o item **sugere** a mudança de fase: registra o evento e
 * uma mensagem no chamado, mas quem move a fase é o agente. Fase em ITIL
 * carrega solução, classificação e, às vezes, aprovação — nada disso cabe no
 * payload do GitHub.
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
 * Atualiza o vínculo e registra o espelhamento no chamado. Compartilhado
 * entre o webhook e a reconciliação horária.
 */
export async function applySdGithubState(input: {
  integration: SdIntegration
  link: SdIntegrationLink
  state: SdGithubExternalState
  kind: SdGithubRefKind
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

  const config = parseSdGithubConfig(integration.config)
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

    // Lookup antes da verificação: o nome do repositório só serve para achar
    // o segredo. Nada é gravado nem consultado do chamado antes do HMAC.
    const found = await SdIntegrationRepository.findByExternalId(
      'GITHUB',
      sdGithubRepoKey(repo),
    )
    if (!found.ok) return found
    const integration = found.value
    if (!integration || integration.status === 'DISCONNECTED') {
      return err(
        sdIntegrationNotConfigured(
          'Este repositório não está conectado a nenhum ServiceDesk',
        ),
      )
    }

    const secret = await decryptSdIntegrationSecret(integration)
    if (!secret.ok) return secret
    if (!secret.value) {
      return err(
        sdIntegrationNotConfigured(
          'A integração do GitHub está sem segredo de webhook configurado',
        ),
      )
    }
    if (
      !verifyGithubSignature({
        secret: secret.value,
        signature: input.signature,
        rawBody: input.rawBody,
      })
    ) {
      return err(sdIntegrationSignatureInvalid('Assinatura do GitHub inválida'))
    }

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
    const link = await SdIntegrationRepository.findGithubLinkByKey(
      integration.id,
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

/** Quantos vínculos a reconciliação horária olha por rodada. */
const SYNC_BATCH = 200

/**
 * Reconciliação horária (`sync-github-state`): confere na API o estado das
 * issues/PRs vinculadas a chamados ainda abertos. Existe para o caso de um
 * webhook perdido — o resultado é idêntico ao do webhook.
 */
export const SdGithubSyncService = {
  async runTick(workspaceId?: string): Promise<Result<SdGithubSyncResult>> {
    const links = await SdIntegrationRepository.listGithubLinksToSync(
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
      const ref = parseSdGithubRepo(integration.externalId)
      if (!ref) {
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

      const number = Number(link.externalKey.split('#')[1])
      if (!Number.isInteger(number) || number <= 0) {
        result.failed += 1
        continue
      }

      const item = await GithubClient.getItem(token, ref, number)
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
        url: item.value.htmlUrl,
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
