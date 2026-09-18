import { Queue } from 'bullmq'
import { getQueueConnection } from './connection'
import {
  type AccountLifecycleJob,
  type AccountLifecycleJobPayload,
  type ChangelogJob,
  type ChangelogJobPayload,
  type CrmCompetitorSyncJob,
  type CrmCompetitorSyncJobPayload,
  type CrmProposalExpiryJob,
  type CrmProposalExpiryJobPayload,
  type CrmScheduledSendJob,
  type CrmScheduledSendJobPayload,
  type CrmSocialPostsTickJob,
  type CrmSocialPostsTickJobPayload,
  type CrmSocialPublishJob,
  type CrmSocialPublishJobPayload,
  type CrmWorkflowScheduleJob,
  type CrmWorkflowScheduleJobPayload,
  type DatabaseBackupJob,
  type DatabaseBackupJobPayload,
  type DataExportJob,
  type DataExportJobPayload,
  type DataRetentionJob,
  type DataRetentionJobPayload,
  QueueName,
  type StatusCollectJob,
  type StatusCollectJobPayload,
  type TrialLifecycleJob,
  type TrialLifecycleJobPayload,
  type UsageRollupJob,
  type UsageRollupJobPayload,
  type WhatsappAiReplyJob,
  type WhatsappAiReplyJobPayload,
  type WhatsappBroadcastJob,
  type WhatsappBroadcastJobPayload,
  type WhatsappConversationLifecycleJob,
  type WhatsappConversationLifecycleJobPayload,
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
let whatsappConversationLifecycleQueue: Queue | null = null
let crmScheduledSendQueue: Queue | null = null
let crmWorkflowScheduleQueue: Queue | null = null
let crmCompetitorSyncQueue: Queue | null = null
let crmProposalExpiryQueue: Queue | null = null
let crmSocialPostsTickQueue: Queue | null = null
let crmSocialPublishQueue: Queue | null = null
let changelogQueue: Queue | null = null
let databaseBackupQueue: Queue | null = null
let statusCollectQueue: Queue | null = null
let usageRollupQueue: Queue | null = null

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

export function getWhatsappConversationLifecycleQueue(): Queue<
  WhatsappConversationLifecycleJobPayload[WhatsappConversationLifecycleJob],
  unknown,
  WhatsappConversationLifecycleJob
> {
  if (!whatsappConversationLifecycleQueue) {
    whatsappConversationLifecycleQueue = new Queue(
      QueueName.WhatsappConversationLifecycle,
      { connection: getQueueConnection(), defaultJobOptions },
    )
  }
  return whatsappConversationLifecycleQueue as Queue<
    WhatsappConversationLifecycleJobPayload[WhatsappConversationLifecycleJob],
    unknown,
    WhatsappConversationLifecycleJob
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

export function getCrmCompetitorSyncQueue(): Queue<
  CrmCompetitorSyncJobPayload[CrmCompetitorSyncJob],
  unknown,
  CrmCompetitorSyncJob
> {
  if (!crmCompetitorSyncQueue) {
    crmCompetitorSyncQueue = new Queue(QueueName.CrmCompetitorSync, {
      connection: getQueueConnection(),
      defaultJobOptions,
    })
  }
  return crmCompetitorSyncQueue as Queue<
    CrmCompetitorSyncJobPayload[CrmCompetitorSyncJob],
    unknown,
    CrmCompetitorSyncJob
  >
}

export function getCrmProposalExpiryQueue(): Queue<
  CrmProposalExpiryJobPayload[CrmProposalExpiryJob],
  unknown,
  CrmProposalExpiryJob
> {
  if (!crmProposalExpiryQueue) {
    crmProposalExpiryQueue = new Queue(QueueName.CrmProposalExpiry, {
      connection: getQueueConnection(),
      defaultJobOptions,
    })
  }
  return crmProposalExpiryQueue as Queue<
    CrmProposalExpiryJobPayload[CrmProposalExpiryJob],
    unknown,
    CrmProposalExpiryJob
  >
}

export function getCrmSocialPostsTickQueue(): Queue<
  CrmSocialPostsTickJobPayload[CrmSocialPostsTickJob],
  unknown,
  CrmSocialPostsTickJob
> {
  if (!crmSocialPostsTickQueue) {
    crmSocialPostsTickQueue = new Queue(QueueName.CrmSocialPostsTick, {
      connection: getQueueConnection(),
      defaultJobOptions,
    })
  }
  return crmSocialPostsTickQueue as Queue<
    CrmSocialPostsTickJobPayload[CrmSocialPostsTickJob],
    unknown,
    CrmSocialPostsTickJob
  >
}

export function getCrmSocialPublishQueue(): Queue<
  CrmSocialPublishJobPayload[CrmSocialPublishJob],
  unknown,
  CrmSocialPublishJob
> {
  if (!crmSocialPublishQueue) {
    crmSocialPublishQueue = new Queue(QueueName.CrmSocialPublish, {
      connection: getQueueConnection(),
      defaultJobOptions,
    })
  }
  return crmSocialPublishQueue as Queue<
    CrmSocialPublishJobPayload[CrmSocialPublishJob],
    unknown,
    CrmSocialPublishJob
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

/**
 * Sem retry: a coleta é um tick — se um probe falhar, o próximo tick (1–5 min)
 * já coleta de novo, e repetir só empilharia checks atrasados. Guarda poucos
 * jobs concluídos porque o core roda a cada minuto.
 */
const statusCollectJobOptions = {
  removeOnComplete: { age: 60 * 60, count: 100 },
  removeOnFail: { age: 60 * 60 * 24 * 7 },
  attempts: 1,
} as const

export function getStatusCollectQueue(): Queue<
  StatusCollectJobPayload[StatusCollectJob],
  unknown,
  StatusCollectJob
> {
  if (!statusCollectQueue) {
    statusCollectQueue = new Queue(QueueName.StatusCollect, {
      connection: getQueueConnection(),
      defaultJobOptions: statusCollectJobOptions,
    })
  }
  return statusCollectQueue as Queue<
    StatusCollectJobPayload[StatusCollectJob],
    unknown,
    StatusCollectJob
  >
}

/**
 * Sem retry: o rollup é um tick idempotente — o próximo (15 min) regrava os
 * mesmos dias.
 */
const usageRollupJobOptions = {
  removeOnComplete: { age: 60 * 60 * 24, count: 100 },
  removeOnFail: { age: 60 * 60 * 24 * 7 },
  attempts: 1,
} as const

export function getUsageRollupQueue(): Queue<
  UsageRollupJobPayload[UsageRollupJob],
  unknown,
  UsageRollupJob
> {
  if (!usageRollupQueue) {
    usageRollupQueue = new Queue(QueueName.UsageRollup, {
      connection: getQueueConnection(),
      defaultJobOptions: usageRollupJobOptions,
    })
  }
  return usageRollupQueue as Queue<
    UsageRollupJobPayload[UsageRollupJob],
    unknown,
    UsageRollupJob
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
    whatsappConversationLifecycleQueue?.close(),
    crmScheduledSendQueue?.close(),
    crmWorkflowScheduleQueue?.close(),
    crmCompetitorSyncQueue?.close(),
    crmProposalExpiryQueue?.close(),
    crmSocialPostsTickQueue?.close(),
    crmSocialPublishQueue?.close(),
    changelogQueue?.close(),
    databaseBackupQueue?.close(),
    statusCollectQueue?.close(),
    usageRollupQueue?.close(),
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
  whatsappConversationLifecycleQueue = null
  crmScheduledSendQueue = null
  crmCompetitorSyncQueue = null
  crmProposalExpiryQueue = null
  crmSocialPostsTickQueue = null
  crmSocialPublishQueue = null
  changelogQueue = null
  databaseBackupQueue = null
  statusCollectQueue = null
  usageRollupQueue = null
}
