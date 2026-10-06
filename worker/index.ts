import { type Job, Worker } from 'bullmq'
import { processTrialLifecycle } from '@/src/lib/queue/processors/trial-lifecycle'
import { logger } from '../lib/axiom/logger'
import { getQueueConnection } from '../src/lib/queue/connection'
import { createJobFailureAlarm } from '../src/lib/queue/failure-alarm'
import {
  type JobFailureListener,
  startJobFailureListener,
} from '../src/lib/queue/failure-listener'
import { QueueName } from '../src/lib/queue/jobs'
import { processAccountLifecycle } from '../src/lib/queue/processors/account-lifecycle'
import { processChangelog } from '../src/lib/queue/processors/changelog'
import { processCrmCompetitorSync } from '../src/lib/queue/processors/crm-competitor-sync'
import { processCrmProposalExpiry } from '../src/lib/queue/processors/crm-proposal-expiry'
import { processCrmScheduledSend } from '../src/lib/queue/processors/crm-scheduled-send'
import { processCrmSocialPostsTick } from '../src/lib/queue/processors/crm-social-posts-tick'
import { processCrmSocialPublish } from '../src/lib/queue/processors/crm-social-publish'
import { processCrmTaskReminders } from '../src/lib/queue/processors/crm-task-reminders'
import { processCrmWorkflowSchedule } from '../src/lib/queue/processors/crm-workflow-schedule'
import { processDataExport } from '../src/lib/queue/processors/data-export'
import { processDataRetention } from '../src/lib/queue/processors/data-retention'
import { processDatabaseBackup } from '../src/lib/queue/processors/database-backup'
import { processServicedeskAi } from '../src/lib/queue/processors/servicedesk-ai'
import { processServicedeskBilling } from '../src/lib/queue/processors/servicedesk-billing'
import { processServicedeskDigest } from '../src/lib/queue/processors/servicedesk-digest'
import { processServicedeskIntegrations } from '../src/lib/queue/processors/servicedesk-integrations'
import { processServicedeskMail } from '../src/lib/queue/processors/servicedesk-mail'
import { processServicedeskRecurring } from '../src/lib/queue/processors/servicedesk-recurring'
import { processServicedeskReports } from '../src/lib/queue/processors/servicedesk-reports'
import { processServicedeskRisk } from '../src/lib/queue/processors/servicedesk-risk'
import { processServicedeskSla } from '../src/lib/queue/processors/servicedesk-sla'
import { processStatusCollect } from '../src/lib/queue/processors/status-collect'
import { processUsageRollup } from '../src/lib/queue/processors/usage-rollup'
import { processWhatsappAiReply } from '../src/lib/queue/processors/whatsapp-ai-reply'
import { processWhatsappBroadcast } from '../src/lib/queue/processors/whatsapp-broadcast'
import { processWhatsappConversationLifecycle } from '../src/lib/queue/processors/whatsapp-conversation-lifecycle'
import { processWhatsappMedia } from '../src/lib/queue/processors/whatsapp-media'
import { processWhatsappSentiment } from '../src/lib/queue/processors/whatsapp-sentiment'
import '../src/lib/zod-locale'
import {
  scheduleCrmCompetitorSyncJobs,
  scheduleCrmProposalExpiryJobs,
  scheduleCrmScheduledSendJobs,
  scheduleCrmSocialPostsTickJobs,
  scheduleCrmTaskRemindersJobs,
  scheduleCrmWorkflowScheduleJobs,
  scheduleDatabaseBackupJobs,
  scheduleDataRetentionJobs,
  scheduleServicedeskBillingJobs,
  scheduleServicedeskDigestJobs,
  scheduleServicedeskIntegrationsJobs,
  scheduleServicedeskMailJobs,
  scheduleServicedeskRecurringJobs,
  scheduleServicedeskReportsJobs,
  scheduleServicedeskRiskJobs,
  scheduleServicedeskSlaJobs,
  scheduleStatusCollectJobs,
  scheduleTrialLifecycleJobs,
  scheduleUsageRollupJobs,
  scheduleWhatsappBroadcastJobs,
  scheduleWhatsappConversationLifecycleJobs,
} from '../src/lib/queue/scheduler'
import { closeWorkerResources } from '../src/lib/queue/worker-shutdown'

const workers: Worker[] = []
// One alarm shared by every Worker and the QueueEvents backstop, so its
// dedup ledger sees both reports of the same death.
const failureAlarm = createJobFailureAlarm()
let failureListener: JobFailureListener | null = null

type Processor = (job: Job) => Promise<unknown>

function registerWorker(name: QueueName, processor: Processor): Worker {
  const worker = new Worker(name, processor, {
    connection: getQueueConnection(),
  })

  worker.on('completed', (job) => {
    logger.info('queue.job.completed', {
      component: 'Worker',
      queue: name,
      jobName: job.name,
      jobId: job.id,
      durationMs:
        job.finishedOn && job.processedOn
          ? job.finishedOn - job.processedOn
          : undefined,
    })
  })

  // Logs every failed attempt and raises `queue.job.exhausted` (and the
  // #alerts post) once BullMQ gives up on the job. That includes a job that
  // exceeded `maxStalledCount`: BullMQ fails it on its next pickup with an
  // UnrecoverableError, which arrives here as reason `stalled`.
  worker.on('failed', (job, err) => {
    failureAlarm.workerFailed(name, job, err)
  })

  // A stall that BullMQ requeues: a warning, never the alarm.
  worker.on('stalled', (jobId) => {
    failureAlarm.stalled(name, jobId)
  })

  worker.on('error', (err) => {
    logger.error('queue.worker.error', {
      component: 'Worker',
      queue: name,
      message: err.message,
      stack: err.stack,
    })
  })

  return worker
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info('queue.worker.shutdown_start', {
    component: 'Worker',
    signal,
  })

  try {
    await closeWorkerResources({ workers, failureListener, failureAlarm })
  } catch (err) {
    const e = err as Error
    logger.error('queue.worker.shutdown_error', {
      component: 'Worker',
      message: e.message,
      stack: e.stack,
    })
    await logger.flush()
    process.exit(1)
  }

  process.exit(0)
}

async function main(): Promise<void> {
  workers.push(registerWorker(QueueName.DataRetention, processDataRetention))
  workers.push(
    registerWorker(QueueName.AccountLifecycle, processAccountLifecycle),
  )
  workers.push(registerWorker(QueueName.DataExport, processDataExport))
  workers.push(registerWorker(QueueName.TrialLifecycle, processTrialLifecycle))
  workers.push(registerWorker(QueueName.WhatsappMedia, processWhatsappMedia))
  workers.push(
    registerWorker(QueueName.WhatsappAiReply, processWhatsappAiReply),
  )
  workers.push(
    registerWorker(QueueName.WhatsappSentiment, processWhatsappSentiment),
  )
  workers.push(
    registerWorker(QueueName.WhatsappBroadcast, processWhatsappBroadcast),
  )
  workers.push(
    registerWorker(
      QueueName.WhatsappConversationLifecycle,
      processWhatsappConversationLifecycle,
    ),
  )
  workers.push(
    registerWorker(QueueName.CrmScheduledSend, processCrmScheduledSend),
  )
  workers.push(
    registerWorker(QueueName.CrmWorkflowSchedule, processCrmWorkflowSchedule),
  )
  workers.push(
    registerWorker(QueueName.CrmCompetitorSync, processCrmCompetitorSync),
  )
  workers.push(
    registerWorker(QueueName.CrmProposalExpiry, processCrmProposalExpiry),
  )
  workers.push(
    registerWorker(QueueName.CrmSocialPostsTick, processCrmSocialPostsTick),
  )
  workers.push(
    registerWorker(QueueName.CrmSocialPublish, processCrmSocialPublish),
  )
  workers.push(registerWorker(QueueName.Changelog, processChangelog))
  workers.push(registerWorker(QueueName.DatabaseBackup, processDatabaseBackup))
  workers.push(registerWorker(QueueName.StatusCollect, processStatusCollect))
  workers.push(registerWorker(QueueName.UsageRollup, processUsageRollup))
  workers.push(registerWorker(QueueName.ServicedeskSla, processServicedeskSla))
  workers.push(registerWorker(QueueName.ServicedeskAi, processServicedeskAi))
  workers.push(
    registerWorker(QueueName.ServicedeskMail, processServicedeskMail),
    registerWorker(QueueName.ServicedeskDigest, processServicedeskDigest),
    registerWorker(QueueName.ServicedeskRecurring, processServicedeskRecurring),
    registerWorker(QueueName.ServicedeskBilling, processServicedeskBilling),
    registerWorker(QueueName.ServicedeskReports, processServicedeskReports),
    registerWorker(QueueName.ServicedeskRisk, processServicedeskRisk),
    registerWorker(
      QueueName.ServicedeskIntegrations,
      processServicedeskIntegrations,
    ),
  )
  workers.push(
    registerWorker(QueueName.CrmTaskReminders, processCrmTaskReminders),
  )

  failureListener = startJobFailureListener(
    workers.map((w) => w.name as QueueName),
    { alarm: failureAlarm, connection: getQueueConnection() },
  )

  await scheduleDataRetentionJobs()
  await scheduleTrialLifecycleJobs()
  await scheduleCrmScheduledSendJobs()
  await scheduleCrmWorkflowScheduleJobs()
  await scheduleCrmCompetitorSyncJobs()
  await scheduleCrmProposalExpiryJobs()
  await scheduleCrmSocialPostsTickJobs()
  await scheduleWhatsappBroadcastJobs()
  await scheduleWhatsappConversationLifecycleJobs()
  await scheduleDatabaseBackupJobs()
  await scheduleStatusCollectJobs()
  await scheduleUsageRollupJobs()
  await scheduleServicedeskSlaJobs()
  await scheduleServicedeskMailJobs()
  await scheduleServicedeskDigestJobs()
  await scheduleServicedeskRecurringJobs()
  await scheduleServicedeskBillingJobs()
  await scheduleServicedeskReportsJobs()
  await scheduleServicedeskRiskJobs()
  await scheduleServicedeskIntegrationsJobs()
  await scheduleCrmTaskRemindersJobs()

  logger.info('queue.worker.started', {
    component: 'Worker',
    queues: workers.map((w) => w.name),
  })

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch(async (err) => {
  const e = err as Error
  logger.error('queue.worker.bootstrap_error', {
    component: 'Worker',
    message: e.message,
    stack: e.stack,
  })
  await logger.flush()
  process.exit(1)
})
