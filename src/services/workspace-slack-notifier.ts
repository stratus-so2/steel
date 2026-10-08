import { logFields } from '@/lib/axiom/log-fields'
import { logger } from '@/lib/axiom/logger'
import { NEXT_PUBLIC_URL } from '@/lib/env/env'
import { SdIntegrationEventCache } from '@/src/cache/sd-integration-event.cache'
import { sdIntegrationNotFound } from '@/src/errors'
import {
  parseWorkspaceSlackConfig,
  slackChannelsFor,
} from '@/src/lib/integrations/config'
import { WorkspaceIntegrationsJob } from '@/src/lib/queue/jobs'
import { getWorkspaceIntegrationsQueue } from '@/src/lib/queue/queues'
import { err, ok, type Result } from '@/src/lib/result'
import { escapeSlackText } from '@/src/lib/servicedesk/integrations'
import { SlackClient } from '@/src/lib/servicedesk/slack-client'
import { WorkspaceRepository } from '@/src/repositories/workspace.repository'
import { WorkspaceIntegrationRepository } from '@/src/repositories/workspace-integration.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { decryptSdIntegrationToken } from './sd-integration-credentials'

/**
 * Slack notifications of every module (Ajustes > Integrações, ADR 0024).
 *
 * `notifyWorkspaceSlack` runs on the request path and only does the cheap
 * filter (live Slack connection + a rule for the event) before
 * **enqueueing**; the `slack-notify` job talks to Slack. It never throws and
 * never waits on the network: Slack being down must not slow a CRM save or
 * an agent run. ServiceDesk events keep their own job (team channels,
 * `SdIntegrationDispatcher`) but read the same rules.
 */

export const COMMUNICATION_WAITING_EVENT = 'communication.conversation.waiting'

/** Conversations older than this are not announced (stale backlog). */
const WAITING_HORIZON_MS = 24 * 60 * 60 * 1000
const WAITING_BATCH = 50

export interface WorkspaceSlackNotifyInput {
  workspaceId: string
  /** Catalog key (`crm.deal.won`, `agents.approval.pending`…). */
  event: string
  /** pt-BR. */
  title: string
  /** pt-BR. */
  body: string
  /** Path inside the workspace (`/crm/leads?record=…`); the slug is prefixed. */
  path?: string | null
}

export interface WorkspaceSlackDeliverInput {
  workspaceId: string
  integrationId: string
  event: string
  title: string
  body: string
  url: string | null
}

export type WorkspaceSlackDeliverOutcome =
  | 'sent'
  | 'skipped_disconnected'
  | 'skipped_not_routed'

export interface CommunicationWaitingTickResult {
  workspaces: number
  notified: number
}

/** Message posted to the channel (`mrkdwn`). */
export function slackNotificationText(input: {
  title: string
  body: string
  url: string | null
}): string {
  const lines = [`*${escapeSlackText(input.title)}*`]
  const body = input.body.trim()
  if (body) lines.push(escapeSlackText(body))
  if (input.url) lines.push(`<${input.url}|Abrir no Steel>`)
  return lines.join('\n')
}

function warn(
  event: string,
  workspaceId: string,
  detail: Record<string, unknown>,
) {
  logger.warn(
    event,
    logFields({ component: 'WorkspaceSlackNotifier', workspaceId }, detail),
  )
}

async function enqueue(input: WorkspaceSlackNotifyInput): Promise<boolean> {
  const found = await WorkspaceIntegrationRepository.findByKind(
    input.workspaceId,
    'SLACK',
  )
  if (!found.ok) {
    warn('integrations.slack.lookup_failed', input.workspaceId, {
      event: input.event,
      reason: found.error.code,
    })
    return false
  }
  const integration = found.value
  if (!integration || integration.status === 'DISCONNECTED') return false

  const config = parseWorkspaceSlackConfig(integration.config)
  const channels = slackChannelsFor(config, input.event)
  if (!channels || channels.length === 0) return false

  let url: string | null = null
  if (input.path) {
    const workspace = await WorkspaceRepository.findById(input.workspaceId)
    url = workspace.ok
      ? `${NEXT_PUBLIC_URL}/${workspace.value.slug}${input.path}`
      : null
  }

  await getWorkspaceIntegrationsQueue().add(
    WorkspaceIntegrationsJob.SlackNotify,
    {
      workspaceId: input.workspaceId,
      integrationId: integration.id,
      event: input.event,
      title: input.title,
      body: input.body,
      url,
    },
  )
  return true
}

/**
 * Fire-and-forget entry point for the modules. Resolves to whether a job was
 * enqueued; every failure is logged and swallowed.
 */
export async function notifyWorkspaceSlack(
  input: WorkspaceSlackNotifyInput,
): Promise<boolean> {
  try {
    return await enqueue(input)
  } catch (cause) {
    warn('integrations.slack.enqueue_failed', input.workspaceId, {
      event: input.event,
      message: cause instanceof Error ? cause.message : String(cause),
    })
    return false
  }
}

export const WorkspaceSlackNotifier = {
  /**
   * Delivery (worker): re-reads the connection — the rules may have changed
   * since the enqueue — and posts to every routed channel. A Slack error
   * stamps `status: ERROR` on the connection so the page shows the reason,
   * and fails the job so the queue retries.
   */
  async deliver(
    input: WorkspaceSlackDeliverInput,
  ): Promise<Result<WorkspaceSlackDeliverOutcome>> {
    const found = await WorkspaceIntegrationRepository.findById(
      input.integrationId,
    )
    if (!found.ok) return found
    const integration = found.value
    if (!integration || integration.workspaceId !== input.workspaceId) {
      return err(sdIntegrationNotFound())
    }
    if (integration.status === 'DISCONNECTED') return ok('skipped_disconnected')

    const channels = slackChannelsFor(
      parseWorkspaceSlackConfig(integration.config),
      input.event,
    )
    if (!channels || channels.length === 0) return ok('skipped_not_routed')

    const token = await decryptSdIntegrationToken(integration)
    if (!token.ok) return token

    const text = slackNotificationText(input)
    for (const channel of channels) {
      const sent = await SlackClient.postMessage(token.value, { channel, text })
      if (!sent.ok) {
        await WorkspaceIntegrationRepository.markError(
          integration.id,
          sent.error.message,
        )
        return sent
      }
    }

    await WorkspaceIntegrationRepository.markEvent(
      integration.id,
      `slack:${input.event}`,
    )
    logger.info(
      'integrations.slack.delivered',
      logFields(
        { component: 'WorkspaceSlackNotifier', workspaceId: input.workspaceId },
        { event: input.event, channels: channels.length },
      ),
    )
    return ok('sent')
  },

  /**
   * Every 5 minutes: WhatsApp conversations with unread messages waiting
   * longer than the workspace threshold (and less than 24 h) are announced
   * once per last message (Redis claim keyed by conversation + timestamp).
   */
  async runWaitingTick(
    now: Date = new Date(),
  ): Promise<Result<CommunicationWaitingTickResult>> {
    const slacks = await WorkspaceIntegrationRepository.listLiveByKind('SLACK')
    if (!slacks.ok) return slacks

    const result: CommunicationWaitingTickResult = {
      workspaces: 0,
      notified: 0,
    }
    for (const integration of slacks.value) {
      const config = parseWorkspaceSlackConfig(integration.config)
      const channels = slackChannelsFor(config, COMMUNICATION_WAITING_EVENT)
      if (!channels || channels.length === 0) continue

      const enabled = await WorkspaceModuleAccessRepository.isEnabled(
        integration.workspaceId,
        'COMMUNICATION',
      )
      if (!enabled.ok || !enabled.value) continue
      result.workspaces += 1

      const waiting =
        await WorkspaceIntegrationRepository.listWaitingConversations(
          integration.workspaceId,
          new Date(now.getTime() - config.waitingMinutes * 60_000),
          new Date(now.getTime() - WAITING_HORIZON_MS),
          WAITING_BATCH,
        )
      if (!waiting.ok) {
        warn(
          'integrations.slack.waiting_lookup_failed',
          integration.workspaceId,
          {
            reason: waiting.error.code,
          },
        )
        continue
      }

      for (const conversation of waiting.value) {
        const first = await SdIntegrationEventCache.claim(
          'waiting',
          `${conversation.id}:${conversation.lastMessageAt.toISOString()}`,
        )
        if (!first) continue
        const minutes = Math.floor(
          (now.getTime() - conversation.lastMessageAt.getTime()) / 60_000,
        )
        const queued = await notifyWorkspaceSlack({
          workspaceId: integration.workspaceId,
          event: COMMUNICATION_WAITING_EVENT,
          title: `Conversa aguardando resposta há ${minutes} min`,
          body: `${conversation.contactName ?? 'Contato sem nome'} · ${conversation.unreadCount} mensagem(ns) sem resposta`,
          path: `/zap?conversa=${conversation.id}`,
        })
        if (queued) result.notified += 1
      }
    }

    logger.info(
      'integrations.slack.waiting_tick',
      logFields({ component: 'Worker' }, { ...result }),
    )
    return ok(result)
  },
}
