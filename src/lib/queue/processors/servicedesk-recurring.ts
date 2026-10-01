import type { Job } from 'bullmq'
import { logger } from '@/lib/axiom/logger'
import {
  SdRecurringTicketRunner,
  type SdRecurringTickResult,
} from '@/src/services/sd-recurring-ticket-runner'
import { ServicedeskRecurringJob } from '../jobs'

/**
 * Fila `servicedesk-recurring` (a cada 5 min, `ServicedeskRecurringCron`):
 * delega ao `SdRecurringTicketRunner.runTick`, que abre os chamados das
 * rotinas vencidas. Sem retry: o próximo tick cobre o que falhar, e a trava
 * `(recurringId, scheduledFor)` impede duplicata.
 */
export async function processServicedeskRecurring(
  job: Job,
): Promise<SdRecurringTickResult> {
  switch (job.name) {
    case ServicedeskRecurringJob.RunTick: {
      const result = await SdRecurringTicketRunner.runTick()
      logger.info('queue.servicedesk_recurring.tick_completed', {
        component: 'Worker',
        jobId: job.id,
        ...result,
      })
      return result
    }
    default:
      throw new Error(
        `Unknown servicedesk-recurring job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
