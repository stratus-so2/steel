import { logger } from '@/lib/axiom/logger'
import { ServicedeskIntegrationsJob } from '@/src/lib/queue/jobs'
import { getServicedeskIntegrationsQueue } from '@/src/lib/queue/queues'

/**
 * Enfileiramento da saída para Slack e GitHub (fila
 * `servicedesk-integrations`). **Nunca lança e nunca espera a rede**: uma
 * indisponibilidade do Slack não pode atrasar a requisição, o relógio do SLA
 * nem o e-mail — falha ao enfileirar só é logada.
 */

export interface SdIntegrationEventPayload {
  workspaceId: string
  integrationId: string
  /** Chave do catálogo de notificações (`SD_NOTIFICATION_EVENTS`). */
  event: string
  ticketId?: string
  payload?: Record<string, unknown>
}

export async function enqueueSdIntegrationEvent(
  input: SdIntegrationEventPayload,
): Promise<void> {
  try {
    await getServicedeskIntegrationsQueue().add(
      ServicedeskIntegrationsJob.DeliverEvent,
      input,
    )
  } catch (error) {
    logger.error('servicedesk.integration.enqueue_failed', {
      job: ServicedeskIntegrationsJob.DeliverEvent,
      workspaceId: input.workspaceId,
      event: input.event,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

/** Reconciliação sob demanda do estado das issues/PRs de um workspace. */
export async function enqueueSdGithubStateSync(
  workspaceId?: string,
): Promise<void> {
  try {
    await getServicedeskIntegrationsQueue().add(
      ServicedeskIntegrationsJob.SyncGithubState,
      workspaceId ? { workspaceId } : {},
    )
  } catch (error) {
    logger.error('servicedesk.integration.enqueue_failed', {
      job: ServicedeskIntegrationsJob.SyncGithubState,
      workspaceId,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
