import { logger } from '@/lib/axiom/logger'
import { NEXT_PUBLIC_URL } from '@/lib/env/env'
import { sdIntegrationNotFound } from '@/src/errors'
import {
  SD_URGENT_TICKET_EVENT,
  sdSlackEventKey,
} from '@/src/lib/integrations/catalog'
import {
  parseWorkspaceSlackConfig,
  slackChannelsFor,
  type WorkspaceSlackConfig,
} from '@/src/lib/integrations/config'
import { err, ok, type Result } from '@/src/lib/result'
import { sdSlackEventText } from '@/src/lib/servicedesk/integrations'
import { enqueueSdIntegrationEvent } from '@/src/lib/servicedesk/integrations-queue'
import { sdTicketNotificationHref } from '@/src/lib/servicedesk/notify'
import { SlackClient } from '@/src/lib/servicedesk/slack-client'
import { SdIntegrationRepository } from '@/src/repositories/sd-integration.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { WorkspaceIntegrationRepository } from '@/src/repositories/workspace-integration.repository'
import { decryptSdIntegrationToken } from './sd-integration-credentials'

/**
 * ServiceDesk events to Slack. The connection and the rules (event →
 * channel) are workspace-level (Ajustes > Integrações, ADR 0024); the
 * ServiceDesk settings add the channel per team, which replaces the rule
 * channel for tickets of that team.
 *
 * `dispatch` runs on the request path and only does the cheap filter (live
 * connection + a rule for the event) before **enqueueing**; the
 * `deliver-event` job talks to Slack. Nothing here throws.
 */

export interface SdIntegrationDispatchInput {
  workspaceId: string
  /** ServiceDesk catalog key (`sla.breached`, `ticket.escalated`…). */
  event: string
  ticket: {
    id: string
    number: number
    code: string
    title: string
    departmentId: string | null
  }
  payload: { title: string; body: string }
}

export interface SdIntegrationDeliverInput {
  workspaceId: string
  integrationId: string
  /** ServiceDesk catalog key, or `ticket.urgent` (derived event). */
  event: string
  ticketId?: string
  payload?: Record<string, unknown>
}

export type SdIntegrationDeliverOutcome =
  | 'sent'
  | 'skipped_disconnected'
  | 'skipped_not_selected'
  | 'skipped_no_channel'

/** SD event that also triggers the derived "urgent ticket" event. */
const CREATED_EVENT = 'ticket.created_in_department'
const URGENT_SD_EVENT = SD_URGENT_TICKET_EVENT.slice('servicedesk.'.length)

function str(
  payload: Record<string, unknown> | undefined,
  key: string,
): string {
  const value = payload?.[key]
  return typeof value === 'string' ? value : ''
}

function nullableStr(
  payload: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const value = payload?.[key]
  return typeof value === 'string' && value !== '' ? value : null
}

function channelsOf(
  config: WorkspaceSlackConfig,
  event: string,
  departmentId: string | null,
): string[] | null {
  return slackChannelsFor(config, sdSlackEventKey(event), departmentId)
}

async function enqueueEvent(
  input: SdIntegrationDispatchInput,
  integrationId: string,
  event: string,
  payload: { title: string; body: string },
): Promise<void> {
  await enqueueSdIntegrationEvent({
    workspaceId: input.workspaceId,
    integrationId,
    event,
    ticketId: input.ticket.id,
    payload: {
      title: payload.title,
      body: payload.body,
      ticketCode: input.ticket.code,
      ticketTitle: input.ticket.title,
      ticketNumber: input.ticket.number,
      departmentId: input.ticket.departmentId,
    },
  })
}

async function dispatchSlack(input: SdIntegrationDispatchInput): Promise<void> {
  const found = await WorkspaceIntegrationRepository.findByKind(
    input.workspaceId,
    'SLACK',
  )
  if (!found.ok) {
    logger.warn('servicedesk.integration.dispatch_lookup_failed', {
      workspaceId: input.workspaceId,
      event: input.event,
      reason: found.error.code,
    })
    return
  }
  const integration = found.value
  if (!integration || integration.status === 'DISCONNECTED') return

  const config = parseWorkspaceSlackConfig(integration.config)
  const departmentId = input.ticket.departmentId

  const channels = channelsOf(config, input.event, departmentId)
  if (channels && channels.length > 0) {
    await enqueueEvent(input, integration.id, input.event, input.payload)
  }

  // Derived event: a new ticket born with the workspace's top priority.
  if (input.event !== CREATED_EVENT) return
  const urgent = channelsOf(config, URGENT_SD_EVENT, departmentId)
  if (!urgent || urgent.length === 0) return
  const top = await SdIntegrationRepository.isTopPriorityTicket(
    input.workspaceId,
    input.ticket.id,
  )
  if (!top.ok || !top.value) return
  await enqueueEvent(input, integration.id, URGENT_SD_EVENT, {
    title: `Chamado urgente: ${input.ticket.code}`,
    body: input.payload.body,
  })
}

export const SdIntegrationDispatcher = {
  /**
   * Decides whether the event goes to Slack and enqueues. Called by the
   * notification engine (`notifySdEvent`), the single point every ticket
   * event goes through.
   */
  async dispatch(input: SdIntegrationDispatchInput): Promise<void> {
    try {
      await dispatchSlack(input)
    } catch (error) {
      // Called with `void` by the notification engine: nothing here may
      // become an unhandled rejection.
      logger.warn('servicedesk.integration.dispatch_failed', {
        workspaceId: input.workspaceId,
        event: input.event,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  },

  /**
   * Delivery (worker): re-reads the connection — the rules may have changed
   * between enqueue and delivery — and posts to the team channel or the
   * rule channels. A Slack error stamps `status: ERROR` on the connection.
   */
  async deliver(
    input: SdIntegrationDeliverInput,
  ): Promise<Result<SdIntegrationDeliverOutcome>> {
    const found = await WorkspaceIntegrationRepository.findById(
      input.integrationId,
    )
    if (!found.ok) return found
    const integration = found.value
    if (!integration || integration.workspaceId !== input.workspaceId) {
      return err(sdIntegrationNotFound())
    }
    if (integration.status === 'DISCONNECTED') {
      return ok('skipped_disconnected')
    }

    const channels = channelsOf(
      parseWorkspaceSlackConfig(integration.config),
      input.event,
      nullableStr(input.payload, 'departmentId'),
    )
    if (!channels) return ok('skipped_not_selected')
    if (channels.length === 0) return ok('skipped_no_channel')

    const token = await decryptSdIntegrationToken(integration)
    if (!token.ok) return token

    const workspace = await SdTicketContextRepository.findWorkspace(
      input.workspaceId,
    )
    const slug = workspace.ok ? (workspace.value?.slug ?? null) : null
    const number = input.payload?.ticketNumber
    const href =
      slug && typeof number === 'number'
        ? `${NEXT_PUBLIC_URL}${sdTicketNotificationHref(slug, number)}`
        : NEXT_PUBLIC_URL

    const text = sdSlackEventText({
      ticketCode: str(input.payload, 'ticketCode'),
      ticketTitle: str(input.payload, 'ticketTitle'),
      title: str(input.payload, 'title'),
      body: str(input.payload, 'body'),
      url: href,
    })
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
      `slack:${sdSlackEventKey(input.event)}`,
    )
    logger.info('servicedesk.integration.event_delivered', {
      workspaceId: input.workspaceId,
      integrationId: integration.id,
      event: input.event,
      channels: channels.length,
    })
    return ok('sent')
  },
}
