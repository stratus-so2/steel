import type { Job } from 'bullmq'
import { logger } from '@/lib/axiom/logger'
import { CrmCampaignSendService } from '@/src/services/crm-campaign-send.service'
import { CrmCampaignsJob, type CrmCampaignsJobPayload } from '../jobs'

/**
 * `crm-campaigns` queue (ADR 0025). BullMQ calls processors with
 * `(job, token)`; the exported processor takes only the job and the inner
 * function takes the clock, so tests drive time explicitly.
 */
export async function runCrmCampaignsJob(
  job: Job,
  now: Date,
): Promise<unknown> {
  const base = { component: 'CrmCampaigns', jobId: job.id }

  switch (job.name) {
    case CrmCampaignsJob.Dispatch: {
      const data = job.data as CrmCampaignsJobPayload['dispatch']
      const result = await CrmCampaignSendService.dispatch(
        data.campaignId,
        data.channel,
        now,
      )
      if (!result.ok) {
        throw new Error(`Failed to dispatch CRM campaign: ${result.error.code}`)
      }
      logger.info('queue.crm_campaigns.dispatched', {
        ...base,
        campaignId: data.campaignId,
        channel: data.channel,
        status: result.value.status,
      })
      return result.value
    }
    case CrmCampaignsJob.Send: {
      const data = job.data as CrmCampaignsJobPayload['send']
      const result = await CrmCampaignSendService.send(
        data.campaignId,
        data.recipientId,
        data.channel,
        now,
      )
      if (!result.ok) {
        throw new Error(
          `Failed to send CRM campaign message: ${result.error.code}`,
        )
      }
      // Rate limited: the row went back to PENDING — let BullMQ retry later.
      if (result.value.status === 'retry') {
        throw new Error(`CRM campaign send deferred: ${result.value.reason}`)
      }
      logger.info('queue.crm_campaigns.sent', {
        ...base,
        campaignId: data.campaignId,
        recipientId: data.recipientId,
        channel: data.channel,
        status: result.value.status,
      })
      return result.value
    }
    case CrmCampaignsJob.Tick: {
      const result = await CrmCampaignSendService.tick(now)
      if (!result.ok) {
        throw new Error(`CRM campaigns tick failed: ${result.error.code}`)
      }
      logger.info('queue.crm_campaigns.tick_completed', {
        ...base,
        ...result.value,
      })
      return result.value
    }
    default:
      throw new Error(
        `Unknown crm-campaigns job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}

export function processCrmCampaigns(job: Job): Promise<unknown> {
  return runCrmCampaignsJob(job, new Date())
}
