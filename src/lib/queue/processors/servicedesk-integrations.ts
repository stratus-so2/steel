import type { Job } from 'bullmq'
import { logger } from '@/lib/axiom/logger'
import {
  type SdGithubSyncResult,
  SdGithubSyncService,
} from '@/src/services/sd-github-webhook.service'
import {
  type SdIntegrationDeliverOutcome,
  SdIntegrationDispatcher,
} from '@/src/services/sd-integration-dispatcher'
import { ServicedeskIntegrationsJob } from '../jobs'

/**
 * Fila `servicedesk-integrations`:
 *
 * - `deliver-event`: manda ao Slack o evento que o workspace escolheu, no
 *   canal do time. Fica fora do caminho da requisição de propósito — uma
 *   indisponibilidade do Slack não pode atrasar o chamado nem o SLA; o
 *   retry padrão da fila (3 tentativas, backoff exponencial) cobre a falha
 *   passageira.
 * - `sync-github-state` (de hora em hora, `ServicedeskIntegrationsCron`):
 *   reconcilia o estado das issues/PRs vinculadas, para o caso de um webhook
 *   perdido.
 */
export async function processServicedeskIntegrations(
  job: Job,
): Promise<SdIntegrationDeliverOutcome | SdGithubSyncResult> {
  switch (job.name) {
    case ServicedeskIntegrationsJob.DeliverEvent: {
      const data = job.data as {
        workspaceId: string
        integrationId: string
        event: string
        ticketId?: string
        payload?: Record<string, unknown>
      }
      const result = await SdIntegrationDispatcher.deliver(data)
      if (!result.ok) {
        // Lança para a fila tentar de novo (o Slack pode estar fora do ar).
        throw new Error(
          `servicedesk-integrations deliver-event failed: ${result.error.code}`,
        )
      }
      logger.info('queue.servicedesk_integrations.event_delivered', {
        component: 'Worker',
        jobId: job.id,
        workspaceId: data.workspaceId,
        event: data.event,
        outcome: result.value,
      })
      return result.value
    }

    case ServicedeskIntegrationsJob.SyncGithubState: {
      const data = job.data as { workspaceId?: string }
      const result = await SdGithubSyncService.runTick(data?.workspaceId)
      if (!result.ok) {
        throw new Error(
          `servicedesk-integrations sync-github-state failed: ${result.error.code}`,
        )
      }
      logger.info('queue.servicedesk_integrations.sync_completed', {
        component: 'Worker',
        jobId: job.id,
        ...result.value,
      })
      return result.value
    }

    default:
      throw new Error(
        `Unknown servicedesk-integrations job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
