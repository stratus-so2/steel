import { logger } from '@/lib/axiom/logger'
import { TRIAL_EXPIRY_CRON } from '@/src/config/trial'
import {
  CrmScheduledSendJob,
  DataRetentionJob,
  TrialLifecycleJob,
} from './jobs'
import {
  getCrmScheduledSendQueue,
  getDataRetentionQueue,
  getTrialLifecycleQueue,
} from './queues'
import {
  CrmScheduledSendCron,
  RetentionCron,
  RetentionTimezone,
} from './retention'

export async function scheduleDataRetentionJobs(): Promise<void> {
  const queue = getDataRetentionQueue()
  const repeat = {
    pattern: RetentionCron.dataRetention,
    tz: RetentionTimezone,
  }

  await queue.upsertJobScheduler(
    DataRetentionJob.CleanupExpiredSessions,
    repeat,
    { name: DataRetentionJob.CleanupExpiredSessions, data: {} },
  )

  await queue.upsertJobScheduler(
    DataRetentionJob.CleanupExpiredVerificationTokens,
    repeat,
    { name: DataRetentionJob.CleanupExpiredVerificationTokens, data: {} },
  )

  await queue.upsertJobScheduler(
    DataRetentionJob.ExpireStaleInvitations,
    repeat,
    { name: DataRetentionJob.ExpireStaleInvitations, data: {} },
  )

  logger.info('queue.scheduler.data_retention_registered', {
    component: 'Worker',
    pattern: RetentionCron.dataRetention,
    timezone: RetentionTimezone,
    jobs: [
      DataRetentionJob.CleanupExpiredSessions,
      DataRetentionJob.CleanupExpiredVerificationTokens,
      DataRetentionJob.ExpireStaleInvitations,
    ],
  })
}

export async function scheduleTrialLifecycleJobs(): Promise<void> {
  const queue = getTrialLifecycleQueue()
  await queue.upsertJobScheduler(
    TrialLifecycleJob.RevertExpiredTrials,
    { pattern: TRIAL_EXPIRY_CRON, tz: RetentionTimezone },
    { name: TrialLifecycleJob.RevertExpiredTrials, data: {} },
  )

  logger.info('queue.scheduler.trial_lifecycle_registered', {
    component: 'Worker',
    pattern: TRIAL_EXPIRY_CRON,
    timezone: RetentionTimezone,
  })
}

export async function scheduleCrmScheduledSendJobs(): Promise<void> {
  const queue = getCrmScheduledSendQueue()
  await queue.upsertJobScheduler(
    CrmScheduledSendJob.RunTick,
    { pattern: CrmScheduledSendCron, tz: RetentionTimezone },
    { name: CrmScheduledSendJob.RunTick, data: {} },
  )

  logger.info('queue.scheduler.crm_scheduled_send_registered', {
    component: 'Worker',
    pattern: CrmScheduledSendCron,
    timezone: RetentionTimezone,
  })
}
