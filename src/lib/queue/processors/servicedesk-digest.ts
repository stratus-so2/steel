import type { Job } from 'bullmq'
import { logger } from '@/lib/axiom/logger'
import {
  type SdDigestResult,
  SdDigestService,
} from '@/src/services/sd-digest.service'
import {
  type SdKbReviewDueResult,
  SdKbReviewService,
} from '@/src/services/sd-kb-review.service'
import { ServicedeskDigestJob } from '../jobs'

export interface SdDigestTickResult extends SdDigestResult {
  /** KCS: aviso de artigos com a revisão vencida, no mesmo tique diário. */
  kbReviewDue: SdKbReviewDueResult
}

/**
 * Fila `servicedesk-digest` (de hora em hora, `ServicedeskDigestCron`):
 * delega ao `SdDigestService.runTick` e, no mesmo tique, à checagem de
 * validade dos artigos da base (`SdKbReviewService.runDueCheck`) — as duas só
 * agem nos workspaces cuja hora local é a combinada, o que dá uma passada por
 * dia sem fila nova. Sem retry (`attempts: 1`) para não reenviar.
 */
export async function processServicedeskDigest(
  job: Job,
): Promise<SdDigestTickResult> {
  switch (job.name) {
    case ServicedeskDigestJob.RunTick: {
      const result = await SdDigestService.runTick()
      const kbReviewDue = await SdKbReviewService.runDueCheck()
      logger.info('queue.servicedesk_digest.tick_completed', {
        component: 'Worker',
        jobId: job.id,
        ...result,
        kbOverdue: kbReviewDue.articles,
        kbNotified: kbReviewDue.notified,
      })
      return { ...result, kbReviewDue }
    }
    default:
      throw new Error(
        `Unknown servicedesk-digest job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
