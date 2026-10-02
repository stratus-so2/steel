import { logger } from '@/lib/axiom/logger'
import { NEXT_PUBLIC_URL } from '@/lib/env/env'
import { sdIntegrationNotFound } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  parseSdSlackConfig,
  sdSlackChannelFor,
  sdSlackEventText,
} from '@/src/lib/servicedesk/integrations'
import { enqueueSdIntegrationEvent } from '@/src/lib/servicedesk/integrations-queue'
import { sdTicketNotificationHref } from '@/src/lib/servicedesk/notify'
import { SlackClient } from '@/src/lib/servicedesk/slack-client'
import { SdIntegrationRepository } from '@/src/repositories/sd-integration.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { decryptSdIntegrationToken } from './sd-integration-credentials'

/**
 * Saída de eventos do ServiceDesk para o Slack ("canal por time").
 *
 * `dispatch` roda no caminho da requisição e só faz o filtro barato
 * (integração conectada + evento escolhido pelo workspace) antes de
 * **enfileirar**; quem fala com o Slack é o job `deliver-event` no worker.
 * Assim uma indisponibilidade do Slack nunca atrasa a abertura do chamado
 * nem o relógio do SLA. Nada aqui lança.
 */

export interface SdIntegrationDispatchInput {
  workspaceId: string
  /** Chave do catálogo (`sla.breached`, `ticket.escalated`…). */
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
  event: string
  ticketId?: string
  payload?: Record<string, unknown>
}

export type SdIntegrationDeliverOutcome =
  | 'sent'
  | 'skipped_disconnected'
  | 'skipped_not_selected'
  | 'skipped_no_channel'

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

/**
 * Filtro barato antes de enfileirar: integração conectada, evento escolhido
 * pelo workspace e canal definido para o time do chamado.
 */
async function dispatchSlack(input: SdIntegrationDispatchInput): Promise<void> {
  const found = await SdIntegrationRepository.findByKind(
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

  const config = parseSdSlackConfig(integration.config)
  if (!config.events.includes(input.event)) return
  if (!sdSlackChannelFor(config, input.ticket.departmentId)) return

  await enqueueSdIntegrationEvent({
    workspaceId: input.workspaceId,
    integrationId: integration.id,
    event: input.event,
    ticketId: input.ticket.id,
    payload: {
      title: input.payload.title,
      body: input.payload.body,
      ticketCode: input.ticket.code,
      ticketTitle: input.ticket.title,
      ticketNumber: input.ticket.number,
      departmentId: input.ticket.departmentId,
    },
  })
}

export const SdIntegrationDispatcher = {
  /**
   * Decide se o evento vai para o Slack e enfileira. Chamado pelo motor de
   * notificações (`notifySdEvent`), que é o ponto único por onde passam os
   * eventos de chamado.
   */
  async dispatch(input: SdIntegrationDispatchInput): Promise<void> {
    try {
      await dispatchSlack(input)
    } catch (error) {
      // Chamada em `void` pelo motor de notificações: nada aqui pode virar
      // rejeição não tratada.
      logger.warn('servicedesk.integration.dispatch_failed', {
        workspaceId: input.workspaceId,
        event: input.event,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  },

  /**
   * Executa a entrega (worker): relê a integração — a configuração pode ter
   * mudado entre o enfileiramento e a entrega — e manda a mensagem ao canal
   * do time. Erro do Slack carimba `status: ERROR` na integração para a aba
   * mostrar o motivo.
   */
  async deliver(
    input: SdIntegrationDeliverInput,
  ): Promise<Result<SdIntegrationDeliverOutcome>> {
    const found = await SdIntegrationRepository.findById(input.integrationId)
    if (!found.ok) return found
    const integration = found.value
    if (!integration || integration.workspaceId !== input.workspaceId) {
      return err(sdIntegrationNotFound())
    }
    if (integration.status === 'DISCONNECTED') {
      return ok('skipped_disconnected')
    }

    const config = parseSdSlackConfig(integration.config)
    if (!config.events.includes(input.event)) {
      return ok('skipped_not_selected')
    }

    const channel = sdSlackChannelFor(
      config,
      nullableStr(input.payload, 'departmentId'),
    )
    if (!channel) return ok('skipped_no_channel')

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

    const sent = await SlackClient.postMessage(token.value, {
      channel,
      text: sdSlackEventText({
        ticketCode: str(input.payload, 'ticketCode'),
        ticketTitle: str(input.payload, 'ticketTitle'),
        title: str(input.payload, 'title'),
        body: str(input.payload, 'body'),
        url: href,
      }),
    })
    if (!sent.ok) {
      await SdIntegrationRepository.markError(
        integration.id,
        sent.error.message,
      )
      return sent
    }

    logger.info('servicedesk.integration.event_delivered', {
      workspaceId: input.workspaceId,
      integrationId: integration.id,
      event: input.event,
      channel,
    })
    return ok('sent')
  },
}
