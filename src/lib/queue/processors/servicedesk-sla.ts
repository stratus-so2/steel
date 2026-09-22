import type { Job } from 'bullmq'
import { logger } from '@/lib/axiom/logger'
import {
  SdSlaMonitorService,
  type SdSlaTickResult,
} from '@/src/services/sd-sla-monitor.service'
import { ServicedeskSlaJob } from '../jobs'

/**
 * Fila `servicedesk-sla` (1×/min, `ServicedeskSlaCron`): delega ao
 * `SdSlaMonitorService.runTick` — risco/violação de SLA, escalonamento
 * automático, automações de SLA e fechamento automático de resolvidos.
 */
export async function processServicedeskSla(
  job: Job,
): Promise<SdSlaTickResult> {
  switch (job.name) {
    case ServicedeskSlaJob.RunTick: {
      const result = await SdSlaMonitorService.runTick()
      logger.info('queue.servicedesk_sla.tick_completed', {
        component: 'Worker',
        jobId: job.id,
        ...result,
      })
      return result
    }
    default:
      throw new Error(
        `Unknown servicedesk-sla job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
