export const QueueName = {
  DataRetention: 'data-retention',
  AccountLifecycle: 'account-lifecycle',
  DataExport: 'data-export',
  TrialLifecycle: 'trial-lifecycle',
  WhatsappMedia: 'whatsapp-media',
  WhatsappAiReply: 'whatsapp-ai-reply',
  WhatsappSentiment: 'whatsapp-sentiment',
  WhatsappBroadcast: 'whatsapp-broadcast',
  WhatsappTemplateSync: 'whatsapp-template-sync',
  CrmScheduledSend: 'crm-scheduled-send',
  CrmWorkflowSchedule: 'crm-workflow-schedule',
  Changelog: 'changelog',
  DatabaseBackup: 'database-backup',
} as const

export type QueueName = (typeof QueueName)[keyof typeof QueueName]

export const DataRetentionJob = {
  CleanupExpiredSessions: 'cleanup-expired-sessions',
  CleanupExpiredVerificationTokens: 'cleanup-expired-verification-tokens',
  ExpireStaleInvitations: 'expire-stale-invitations',
} as const

export type DataRetentionJob =
  (typeof DataRetentionJob)[keyof typeof DataRetentionJob]

export type DataRetentionJobPayload = {
  [DataRetentionJob.CleanupExpiredSessions]: Record<string, never>
  [DataRetentionJob.CleanupExpiredVerificationTokens]: Record<string, never>
  [DataRetentionJob.ExpireStaleInvitations]: Record<string, never>
}

export const AccountLifecycleJob = {
  DeleteAccount: 'delete-account',
} as const

export type AccountLifecycleJob =
  (typeof AccountLifecycleJob)[keyof typeof AccountLifecycleJob]

export type AccountLifecycleJobPayload = {
  [AccountLifecycleJob.DeleteAccount]: { userId: string }
}

export const DataExportJob = {
  ExportUserData: 'export-user-data',
} as const

export type DataExportJob = (typeof DataExportJob)[keyof typeof DataExportJob]

export type DataExportJobPayload = {
  [DataExportJob.ExportUserData]: { userId: string }
}

export const TrialLifecycleJob = {
  RevertExpiredTrials: 'revert-expired-trials',
} as const

export type TrialLifecycleJob =
  (typeof TrialLifecycleJob)[keyof typeof TrialLifecycleJob]

export type TrialLifecycleJobPayload = {
  [TrialLifecycleJob.RevertExpiredTrials]: Record<string, never>
}

export const WhatsappMediaJob = {
  DownloadInboundMedia: 'download-inbound-media',
} as const

export type WhatsappMediaJob =
  (typeof WhatsappMediaJob)[keyof typeof WhatsappMediaJob]

export type WhatsappMediaJobPayload = {
  [WhatsappMediaJob.DownloadInboundMedia]: { messageId: string }
}

export const WhatsappAiReplyJob = {
  GenerateAiReply: 'generate-ai-reply',
} as const

export type WhatsappAiReplyJob =
  (typeof WhatsappAiReplyJob)[keyof typeof WhatsappAiReplyJob]

export type WhatsappAiReplyJobPayload = {
  [WhatsappAiReplyJob.GenerateAiReply]: {
    conversationId: string
    messageId: string
  }
}

export const WhatsappSentimentJob = {
  AnalyzeMessage: 'analyze-message',
} as const

export type WhatsappSentimentJob =
  (typeof WhatsappSentimentJob)[keyof typeof WhatsappSentimentJob]

export type WhatsappSentimentJobPayload = {
  [WhatsappSentimentJob.AnalyzeMessage]: { messageId: string }
}

export const WhatsappBroadcastJob = {
  SendBroadcastMessage: 'send-broadcast-message',
  RunScheduleTick: 'run-schedule-tick',
} as const

export type WhatsappBroadcastJob =
  (typeof WhatsappBroadcastJob)[keyof typeof WhatsappBroadcastJob]

export type WhatsappBroadcastJobPayload = {
  [WhatsappBroadcastJob.SendBroadcastMessage]: {
    broadcastListId: string
    recipientId: string
  }
  [WhatsappBroadcastJob.RunScheduleTick]: Record<string, never>
}

export const WhatsappTemplateSyncJob = {
  SyncTemplates: 'sync-templates',
} as const

export type WhatsappTemplateSyncJob =
  (typeof WhatsappTemplateSyncJob)[keyof typeof WhatsappTemplateSyncJob]

export type WhatsappTemplateSyncJobPayload = {
  [WhatsappTemplateSyncJob.SyncTemplates]: { connectionId: string }
}

export const CrmScheduledSendJob = {
  RunTick: 'run-tick',
} as const

export type CrmScheduledSendJob =
  (typeof CrmScheduledSendJob)[keyof typeof CrmScheduledSendJob]

export type CrmScheduledSendJobPayload = {
  [CrmScheduledSendJob.RunTick]: Record<string, never>
}

export const CrmWorkflowScheduleJob = {
  RunTick: 'run-tick',
} as const

export type CrmWorkflowScheduleJob =
  (typeof CrmWorkflowScheduleJob)[keyof typeof CrmWorkflowScheduleJob]

export type CrmWorkflowScheduleJobPayload = {
  [CrmWorkflowScheduleJob.RunTick]: Record<string, never>
}

export const ChangelogJob = {
  SendChangelogEmail: 'send-changelog-email',
} as const

export type ChangelogJob = (typeof ChangelogJob)[keyof typeof ChangelogJob]

export type ChangelogJobPayload = {
  [ChangelogJob.SendChangelogEmail]: {
    changelogId: string
    recipientId: string
  }
}

export const DatabaseBackupJob = {
  RunFullBackup: 'run-full-backup',
  RunWorkspaceBackup: 'run-workspace-backup',
  PruneExpiredBackups: 'prune-expired-backups',
} as const

export type DatabaseBackupJob =
  (typeof DatabaseBackupJob)[keyof typeof DatabaseBackupJob]

export type DatabaseBackupJobPayload = {
  [DatabaseBackupJob.RunFullBackup]: Record<string, never>
  [DatabaseBackupJob.RunWorkspaceBackup]: { workspaceId: string }
  [DatabaseBackupJob.PruneExpiredBackups]: Record<string, never>
}
