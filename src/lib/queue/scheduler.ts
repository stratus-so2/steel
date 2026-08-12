import { logger } from '@/lib/axiom/logger'
import { TRIAL_EXPIRY_CRON } from '@/src/config/trial'
import {
  CrmScheduledSendJob,
  CrmWorkflowScheduleJob,
  DatabaseBackupJob,
  DataRetentionJob,
  TrialLifecycleJob,
  WhatsappBroadcastJob,
} from './jobs'
import {
  getCrmScheduledSendQueue,
  getCrmWorkflowScheduleQueue,
  getDatabaseBackupQueue,
  getDataRetentionQueue,
  getTrialLifecycleQueue,
  getWhatsappBroadcastQueue,
} from './queues'
import {
  CrmScheduledSendCron,
  CrmWorkflowScheduleCron,
  DatabaseBackupCron,
  RetentionCron,
  RetentionTimezone,
  WhatsappBroadcastScheduleCron,
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

export async function scheduleCrmWorkflowScheduleJobs(): Promise<void> {
  const queue = getCrmWorkflowScheduleQueue()
  await queue.upsertJobScheduler(
    CrmWorkflowScheduleJob.RunTick,
    { pattern: CrmWorkflowScheduleCron, tz: RetentionTimezone },
    { name: CrmWorkflowScheduleJob.RunTick, data: {} },
  )

  logger.info('queue.scheduler.crm_workflow_schedule_registered', {
    component: 'Worker',
    pattern: CrmWorkflowScheduleCron,
    timezone: RetentionTimezone,
  })
}

export async function scheduleWhatsappBroadcastJobs(): Promise<void> {
  const queue = getWhatsappBroadcastQueue()
  await queue.upsertJobScheduler(
    WhatsappBroadcastJob.RunScheduleTick,
    { pattern: WhatsappBroadcastScheduleCron, tz: RetentionTimezone },
    { name: WhatsappBroadcastJob.RunScheduleTick, data: {} },
  )

  logger.info('queue.scheduler.whatsapp_broadcast_schedule_registered', {
    component: 'Worker',
    pattern: WhatsappBroadcastScheduleCron,
    timezone: RetentionTimezone,
  })
}

export async function scheduleDatabaseBackupJobs(): Promise<void> {
  const queue = getDatabaseBackupQueue()

  await queue.upsertJobScheduler(
    DatabaseBackupJob.RunFullBackup,
    { pattern: DatabaseBackupCron.fullBackup, tz: RetentionTimezone },
    { name: DatabaseBackupJob.RunFullBackup, data: {} },
  )

  await queue.upsertJobScheduler(
    DatabaseBackupJob.PruneExpiredBackups,
    { pattern: DatabaseBackupCron.pruneExpired, tz: RetentionTimezone },
    { name: DatabaseBackupJob.PruneExpiredBackups, data: {} },
  )

  logger.info('queue.scheduler.database_backup_registered', {
    component: 'Worker',
    fullBackupPattern: DatabaseBackupCron.fullBackup,
    prunePattern: DatabaseBackupCron.pruneExpired,
    timezone: RetentionTimezone,
  })
}
