import type { Job } from 'bullmq'
import { logger } from '@/lib/axiom/logger'
import { CrmCompetitorService } from '@/src/services/crm-competitor.service'
import { CrmCompetitorSyncJob } from '../jobs'

type TickResult = {
  processed: number
  synced: number
  failed: number
}

export async function processCrmCompetitorSync(job: Job): Promise<TickResult> {
  switch (job.name) {
    case CrmCompetitorSyncJob.RunTick: {
      const result = await CrmCompetitorService.syncAll()
      logger.info('queue.crm_competitor_sync.tick_completed', {
        component: 'Worker',
        jobId: job.id,
        processed: result.processed,
        synced: result.synced,
        failed: result.failed,
      })
      return result
    }
    default:
      throw new Error(
        `Unknown crm-competitor-sync job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
