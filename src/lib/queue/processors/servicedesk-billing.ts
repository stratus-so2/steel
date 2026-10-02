import type { Job } from 'bullmq'
import { logger } from '@/lib/axiom/logger'
import {
  type SdBillingTickResult,
  SdContractBillingService,
} from '@/src/services/sd-contract-billing.service'
import { ServicedeskBillingJob } from '../jobs'

/**
 * Fila `servicedesk-billing` (`ServicedeskBillingCron`, 00:20):
 * `SdContractBillingService.runTick` abre o período do ciclo corrente de
 * cada contrato ativo e fecha os anteriores já vencidos, consolidando os
 * apontamentos de hora. Idempotente por `(contractId, periodStart)`, então
 * um retry não duplica período nem valor.
 */
export async function processServicedeskBilling(
  job: Job,
): Promise<SdBillingTickResult> {
  switch (job.name) {
    case ServicedeskBillingJob.RunTick: {
      const result = await SdContractBillingService.runTick()
      if (!result.ok) {
        throw new Error(
          `servicedesk-billing tick failed: ${result.error.code} ${result.error.message}`,
        )
      }
      logger.info('queue.servicedesk_billing.tick_completed', {
        component: 'Worker',
        jobId: job.id,
        ...result.value,
      })
      return result.value
    }
    default:
      throw new Error(
        `Unknown servicedesk-billing job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
