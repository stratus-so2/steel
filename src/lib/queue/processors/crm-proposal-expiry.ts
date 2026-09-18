import type { Job } from 'bullmq'
import { logger } from '@/lib/axiom/logger'
import { CrmProposalService } from '@/src/services/crm-proposal.service'
import { CrmProposalExpiryJob } from '../jobs'

type TickResult = {
  candidates: number
  expired: number
  notified: number
}

export async function processCrmProposalExpiry(job: Job): Promise<TickResult> {
  switch (job.name) {
    case CrmProposalExpiryJob.RunTick: {
      const result = await CrmProposalService.expireDue()
      if (!result.ok) {
        // Falha de leitura do lote: lança para o BullMQ tentar de novo.
        throw new Error(
          `Failed to expire CRM proposals: ${result.error.code} (${result.error.message})`,
        )
      }
      logger.info('queue.crm_proposal_expiry.tick_completed', {
        component: 'Worker',
        jobId: job.id,
        ...result.value,
      })
      return result.value
    }
    default:
      throw new Error(
        `Unknown crm-proposal-expiry job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
