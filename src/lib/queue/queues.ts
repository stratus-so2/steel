import { Queue } from 'bullmq'
import { getQueueConnection } from './connection'
import {
  type AccountLifecycleJob,
  type AccountLifecycleJobPayload,
  type ChangelogJob,
  type ChangelogJobPayload,
  type CrmScheduledSendJob,
  type CrmScheduledSendJobPayload,
  type CrmWorkflowScheduleJob,
  type CrmWorkflowScheduleJobPayload,
  type DatabaseBackupJob,
  type DatabaseBackupJobPayload,
  type DataExportJob,
  type DataExportJobPayload,
  type DataRetentionJob,
  type DataRetentionJobPayload,
  QueueName,
  type TrialLifecycleJob,
  type TrialLifecycleJobPayload,
  type WhatsappAiReplyJob,
  type WhatsappAiReplyJobPayload,
  type WhatsappBroadcastJob,
  type WhatsappBroadcastJobPayload,
  type WhatsappMediaJob,
  type WhatsappMediaJobPayload,
  type WhatsappSentimentJob,
  type WhatsappSentimentJobPayload,
  type WhatsappTemplateSyncJob,
  type WhatsappTemplateSyncJobPayload,
} from './jobs'

const defaultJobOptions = {
  removeOnComplete: { age: 60 * 60 * 24, count: 1000 },
  removeOnFail: { age: 60 * 60 * 24 * 7 },
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
} as const

let dataRetentionQueue: Queue | null = null
let accountLifecycleQueue: Queue | null = null
let dataExportQueue: Queue | null = null
let trialLifecycleQueue: Queue | null = null
let whatsappMediaQueue: Queue | null = null
let whatsappAiReplyQueue: Queue | null = null
let whatsappSentimentQueue: Queue | null = null
let whatsappBroadcastQueue: Queue | null = null
let whatsappTemplateSyncQueue: Queue | null = null
let crmScheduledSendQueue: Queue | null = null
let crmWorkflowScheduleQueue: Queue | null = null
let changelogQueue: Queue | null = null
let databaseBackupQueue: Queue | null = null

export function getDataRetentionQueue(): Queue<
  DataRetentionJobPayload[DataRetentionJob],
  unknown,
  DataRetentionJob
> {
  if (!dataRetentionQueue) {
    dataRetentionQueue = new Queue(QueueName.DataRetention, {
      connection: getQueueConnection(),
      defaultJobOptions,
    })
  }
  return dataRetentionQueue as Queue<
    DataRetentionJobPayload[DataRetentionJob],
    unknown,
    DataRetentionJob
  >
}

export function getAccountLifecycleQueue(): Queue<
  AccountLifecycleJobPayload[AccountLifecycleJob],
  unknown,
  AccountLifecycleJob
> {
  if (!accountLifecycleQueue) {
    accountLifecycleQueue = new Queue(QueueName.AccountLifecycle, {
      connection: getQueueConnection(),
      defaultJobOptions,
    })
  }
  return accountLifecycleQueue as Queue<
    AccountLifecycleJobPayload[AccountLifecycleJob],
    unknown,
    AccountLifecycleJob
  >
}

export function getDataExportQueue(): Queue<
  DataExportJobPayload[DataExportJob],
  unknown,
  DataExportJob
> {
  if (!dataExportQueue) {
    dataExportQueue = new Queue(QueueName.DataExport, {
      connection: getQueueConnection(),
      defaultJobOptions,
    })
  }
  return dataExportQueue as Queue<
    DataExportJobPayload[DataExportJob],
    unknown,
    DataExportJob
  >
}

export function getTrialLifecycleQueue(): Queue<
  TrialLifecycleJobPayload[TrialLifecycleJob],
  unknown,
  TrialLifecycleJob
> {
  if (!trialLifecycleQueue) {
    trialLifecycleQueue = new Queue(QueueName.TrialLifecycle, {
      connection: getQueueConnection(),
      defaultJobOptions,
    })
  }
  return trialLifecycleQueue as Queue<
    TrialLifecycleJobPayload[TrialLifecycleJob],
    unknown,
    TrialLifecycleJob
  >
}

export function getWhatsappMediaQueue(): Queue<
  WhatsappMediaJobPayload[WhatsappMediaJob],
  unknown,
  WhatsappMediaJob
> {
  if (!whatsappMediaQueue) {
    whatsappMediaQueue = new Queue(QueueName.WhatsappMedia, {
      connection: getQueueConnection(),
      defaultJobOptions,
    })
  }
  return whatsappMediaQueue as Queue<
    WhatsappMediaJobPayload[WhatsappMediaJob],
    unknown,
    WhatsappMediaJob
  >
}

export function getWhatsappAiReplyQueue(): Queue<
  WhatsappAiReplyJobPayload[WhatsappAiReplyJob],
  unknown,
  WhatsappAiReplyJob
> {
  if (!whatsappAiReplyQueue) {
    whatsappAiReplyQueue = new Queue(QueueName.WhatsappAiReply, {
      connection: getQueueConnection(),
      defaultJobOptions,
    })
  }
  return whatsappAiReplyQueue as Queue<
    WhatsappAiReplyJobPayload[WhatsappAiReplyJob],
    unknown,
    WhatsappAiReplyJob
  >
}

export function getWhatsappSentimentQueue(): Queue<
  WhatsappSentimentJobPayload[WhatsappSentimentJob],
  unknown,
  WhatsappSentimentJob
> {
  if (!whatsappSentimentQueue) {
    whatsappSentimentQueue = new Queue(QueueName.WhatsappSentiment, {
      connection: getQueueConnection(),
      defaultJobOptions,
    })
  }
  return whatsappSentimentQueue as Queue<
    WhatsappSentimentJobPayload[WhatsappSentimentJob],
    unknown,
    WhatsappSentimentJob
  >
}

export function getWhatsappBroadcastQueue(): Queue<
  WhatsappBroadcastJobPayload[WhatsappBroadcastJob],
  unknown,
  WhatsappBroadcastJob
> {
  if (!whatsappBroadcastQueue) {
    whatsappBroadcastQueue = new Queue(QueueName.WhatsappBroadcast, {
      connection: getQueueConnection(),
      defaultJobOptions,
    })
  }
  return whatsappBroadcastQueue as Queue<
    WhatsappBroadcastJobPayload[WhatsappBroadcastJob],
    unknown,
    WhatsappBroadcastJob
  >
}

export function getChangelogQueue(): Queue<
  ChangelogJobPayload[ChangelogJob],
  unknown,
  ChangelogJob
> {
  if (!changelogQueue) {
    changelogQueue = new Queue(QueueName.Changelog, {
      connection: getQueueConnection(),
      defaultJobOptions,
    })
  }
  return changelogQueue as Queue<
    ChangelogJobPayload[ChangelogJob],
    unknown,
    ChangelogJob
  >
}

export function getWhatsappTemplateSyncQueue(): Queue<
  WhatsappTemplateSyncJobPayload[WhatsappTemplateSyncJob],
  unknown,
  WhatsappTemplateSyncJob
> {
  if (!whatsappTemplateSyncQueue) {
    whatsappTemplateSyncQueue = new Queue(QueueName.WhatsappTemplateSync, {
      connection: getQueueConnection(),
      defaultJobOptions,
    })
  }
  return whatsappTemplateSyncQueue as Queue<
    WhatsappTemplateSyncJobPayload[WhatsappTemplateSyncJob],
    unknown,
    WhatsappTemplateSyncJob
  >
}

export function getCrmScheduledSendQueue(): Queue<
  CrmScheduledSendJobPayload[CrmScheduledSendJob],
  unknown,
  CrmScheduledSendJob
> {
  if (!crmScheduledSendQueue) {
    crmScheduledSendQueue = new Queue(QueueName.CrmScheduledSend, {
      connection: getQueueConnection(),
      defaultJobOptions,
    })
  }
  return crmScheduledSendQueue as Queue<
    CrmScheduledSendJobPayload[CrmScheduledSendJob],
    unknown,
    CrmScheduledSendJob
  >
}

export function getCrmWorkflowScheduleQueue(): Queue<
  CrmWorkflowScheduleJobPayload[CrmWorkflowScheduleJob],
  unknown,
  CrmWorkflowScheduleJob
> {
  if (!crmWorkflowScheduleQueue) {
    crmWorkflowScheduleQueue = new Queue(QueueName.CrmWorkflowSchedule, {
      connection: getQueueConnection(),
      defaultJobOptions,
    })
  }
  return crmWorkflowScheduleQueue as Queue<
    CrmWorkflowScheduleJobPayload[CrmWorkflowScheduleJob],
    unknown,
    CrmWorkflowScheduleJob
  >
}

export function getDatabaseBackupQueue(): Queue<
  DatabaseBackupJobPayload[DatabaseBackupJob],
  unknown,
  DatabaseBackupJob
> {
  if (!databaseBackupQueue) {
    databaseBackupQueue = new Queue(QueueName.DatabaseBackup, {
      connection: getQueueConnection(),
      defaultJobOptions,
    })
  }
  return databaseBackupQueue as Queue<
    DatabaseBackupJobPayload[DatabaseBackupJob],
    unknown,
    DatabaseBackupJob
  >
}

export async function closeQueues(): Promise<void> {
  await Promise.all([
    dataRetentionQueue?.close(),
    accountLifecycleQueue?.close(),
    dataExportQueue?.close(),
    trialLifecycleQueue?.close(),
    whatsappMediaQueue?.close(),
    whatsappAiReplyQueue?.close(),
    whatsappSentimentQueue?.close(),
    whatsappBroadcastQueue?.close(),
    whatsappTemplateSyncQueue?.close(),
    crmScheduledSendQueue?.close(),
    crmWorkflowScheduleQueue?.close(),
    changelogQueue?.close(),
    databaseBackupQueue?.close(),
  ])
  dataRetentionQueue = null
  accountLifecycleQueue = null
  dataExportQueue = null
  trialLifecycleQueue = null
  whatsappMediaQueue = null
  whatsappAiReplyQueue = null
  whatsappSentimentQueue = null
  whatsappBroadcastQueue = null
  whatsappTemplateSyncQueue = null
  crmScheduledSendQueue = null
  changelogQueue = null
  databaseBackupQueue = null
}
