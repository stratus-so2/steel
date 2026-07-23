import type { Job } from 'bullmq'
import { logger } from '@/lib/axiom/logger'
import { CrmEmailCampaignRepository } from '@/src/repositories/crm-email-campaign.repository'
import { CrmEmailCampaignService } from '@/src/services/crm-email-campaign.service'
import { CrmScheduledSendJob } from '../jobs'

type TickResult = {
  due: number
  sent: number
  failed: number
}

async function runTick(): Promise<TickResult> {
  const due = await CrmEmailCampaignRepository.listDueScheduled(new Date())
  if (!due.ok) {
    throw new Error(`Failed to list due CRM email campaigns: ${due.error.code}`)
  }

  let sent = 0
  let failed = 0
  for (const campaign of due.value) {
    const result = await CrmEmailCampaignService.send(
      campaign.createdById,
      campaign.workspaceId,
      campaign.id,
    )
    if (result.ok) {
      sent += 1
    } else {
      failed += 1
      logger.error('queue.crm_scheduled_send.campaign_failed', {
        component: 'Worker',
        campaignId: campaign.id,
        workspaceId: campaign.workspaceId,
        reason: result.error.code,
      })
    }
  }

  return { due: due.value.length, sent, failed }
}

export async function processCrmScheduledSend(job: Job): Promise<TickResult> {
  switch (job.name) {
    case CrmScheduledSendJob.RunTick: {
      const result = await runTick()
      logger.info('queue.crm_scheduled_send.tick_completed', {
        component: 'Worker',
        jobId: job.id,
        due: result.due,
        sent: result.sent,
        failed: result.failed,
      })
      return result
    }
    default:
      throw new Error(
        `Unknown crm-scheduled-send job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
