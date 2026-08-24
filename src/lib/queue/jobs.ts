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
  CrmCompetitorSync: 'crm-competitor-sync',
  CrmSocialPostsTick: 'crm-social-posts-tick',
  CrmSocialPublish: 'crm-social-publish',
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

export const CrmSocialPostsTickJob = {
  RunTick: 'run-tick',
} as const

export type CrmSocialPostsTickJob =
  (typeof CrmSocialPostsTickJob)[keyof typeof CrmSocialPostsTickJob]

export type CrmSocialPostsTickJobPayload = {
  [CrmSocialPostsTickJob.RunTick]: Record<string, never>
}

export const CrmCompetitorSyncJob = {
  RunTick: 'run-tick',
} as const

export type CrmCompetitorSyncJob =
  (typeof CrmCompetitorSyncJob)[keyof typeof CrmCompetitorSyncJob]

export type CrmCompetitorSyncJobPayload = {
  [CrmCompetitorSyncJob.RunTick]: Record<string, never>
}

/**
 * Publish interativo (disparado pela UI, não pelo agendador) de mídia grande
 * demais pra caber num único request síncrono sem esbarrar em timeout de
 * proxy — a rota grava os bytes num bucket temporário e enfileira aqui; o
 * worker chama o mesmo `publishVideo`/`publishPost` que o `crm-social-posts-tick`
 * já usa pros posts agendados. Sem retry automático (`attempts: 1` na
 * chamada de `add`) — publicar não é idempotente, então uma falha após o
 * post já ter ido ao ar não deve tentar de novo.
 */
export const CrmSocialPublishJob = {
  PublishYoutubeVideo: 'publish-youtube-video',
  PublishInstagramMedia: 'publish-instagram-media',
} as const

export type CrmSocialPublishJob =
  (typeof CrmSocialPublishJob)[keyof typeof CrmSocialPublishJob]

export type CrmSocialPublishJobPayload = {
  [CrmSocialPublishJob.PublishYoutubeVideo]: {
    actorId: string
    workspaceId: string
    objectKey: string
    contentType: string
    title: string
    description: string
    tags: string[]
    privacyStatus: 'private' | 'unlisted' | 'public'
  }
  [CrmSocialPublishJob.PublishInstagramMedia]: {
    actorId: string
    workspaceId: string
    connectionId?: string
    objectKey: string
    contentType: string
    kind: 'IMAGE' | 'VIDEO'
    caption: string
    postType: 'FEED' | 'REELS' | 'STORIES'
  }
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
