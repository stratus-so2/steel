const DAY_MS = 24 * 60 * 60 * 1000

export const RetentionWindowMs = {
  sessionAfterExpiry: 30 * DAY_MS,
  verificationAfterExpiry: 1 * DAY_MS,
} as const

export const RetentionCron = {
  dataRetention: '0 3 * * *',
} as const

export const RetentionTimezone = 'America/Sao_Paulo' as const

/** Frequência do tick que dispara campanhas de e-mail agendadas. */
export const CrmScheduledSendCron = '*/5 * * * *' as const

/** Frequência do tick que dispara workflows com trigger `on-a-schedule`. */
export const CrmWorkflowScheduleCron = '*/1 * * * *' as const

/** Frequência do sync de métricas de concorrentes (Instagram/YouTube). */
export const CrmCompetitorSyncCron = '0 4 * * *' as const

/** Frequência do tick que dispara destinatários de broadcast agendados. */
export const WhatsappBroadcastScheduleCron = '*/5 * * * *' as const

export const BackupRetentionDays = 90

export const DatabaseBackupCron = {
  fullBackup: '15 3 * * *',
  pruneExpired: '30 3 * * *',
} as const
