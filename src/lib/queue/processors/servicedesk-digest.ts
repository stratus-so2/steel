import type { Job } from 'bullmq'
import { logger } from '@/lib/axiom/logger'
import {
  SdDigestService,
  type SdDigestResult,
} from '@/src/services/sd-digest.service'
import { ServicedeskDigestJob } from '../jobs'

/**
 * Fila `servicedesk-digest` (de hora em hora, `ServicedeskDigestCron`):
 * delega ao `SdDigestService.runTick`, que só envia aos workspaces cuja
 * hora local é a combinada. Sem retry (`attempts: 1`) para não reenviar.
 */
export async function processServicedeskDigest(
  job: Job,
): Promise<SdDigestResult> {
  switch (job.name) {
    case ServicedeskDigestJob.RunTick: {
      const result = await SdDigestService.runTick()
      logger.info('queue.servicedesk_digest.tick_completed', {
        component: 'Worker',
        jobId: job.id,
        ...result,
      })
      return result
    }
    default:
      throw new Error(
        `Unknown servicedesk-digest job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
