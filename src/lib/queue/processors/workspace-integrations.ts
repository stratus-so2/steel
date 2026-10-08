import type { Job } from 'bullmq'
import { logFields } from '@/lib/axiom/log-fields'
import { logger } from '@/lib/axiom/logger'
import {
  type CommunicationWaitingTickResult,
  type WorkspaceSlackDeliverInput,
  type WorkspaceSlackDeliverOutcome,
  WorkspaceSlackNotifier,
} from '@/src/services/workspace-slack-notifier'
import { WorkspaceIntegrationsJob } from '../jobs'

/**
 * Queue `workspace-integrations` (ADR 0024):
 *
 * - `slack-notify`: posts a routed event of any module to its Slack
 *   channel(s). A Slack failure throws so the queue retries (3 attempts,
 *   exponential backoff).
 * - `communication-waiting-tick` (every 5 min): announces WhatsApp
 *   conversations waiting longer than the workspace threshold.
 */
export async function processWorkspaceIntegrations(
  job: Job,
): Promise<WorkspaceSlackDeliverOutcome | CommunicationWaitingTickResult> {
  switch (job.name) {
    case WorkspaceIntegrationsJob.SlackNotify: {
      const data = job.data as WorkspaceSlackDeliverInput
      const result = await WorkspaceSlackNotifier.deliver(data)
      if (!result.ok) {
        throw new Error(
          `workspace-integrations slack-notify failed: ${result.error.code}`,
        )
      }
      logger.info(
        'queue.workspace_integrations.slack_notified',
        logFields(
          { component: 'Worker', workspaceId: data.workspaceId },
          { jobId: job.id, event: data.event, outcome: result.value },
        ),
      )
      return result.value
    }

    case WorkspaceIntegrationsJob.CommunicationWaitingTick: {
      const result = await WorkspaceSlackNotifier.runWaitingTick()
      if (!result.ok) {
        throw new Error(
          `workspace-integrations communication-waiting-tick failed: ${result.error.code}`,
        )
      }
      return result.value
    }

    default:
      throw new Error(
        `Unknown workspace-integrations job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
