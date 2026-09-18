import { logger } from '@/lib/axiom/logger'
import { DatabaseBackupJob } from './jobs'
import { getDatabaseBackupQueue } from './queues'

export async function triggerWorkspaceBackup(
  workspaceId: string,
  triggeredById?: string,
): Promise<string> {
  const queue = getDatabaseBackupQueue()
  const jobId = `workspace-backup-${workspaceId}-${Date.now()}`

  await queue.add(
    DatabaseBackupJob.RunWorkspaceBackup,
    { workspaceId, ...(triggeredById && { triggeredById }) },
    { jobId },
  )

  logger.info('queue.database_backup.workspace_triggered', {
    component: 'Worker',
    workspaceId,
    triggeredById: triggeredById ?? null,
  })
  return jobId
}

export async function triggerFullBackup(
  triggeredById?: string,
): Promise<string> {
  const jobId = `full-backup-manual-${Date.now()}`
  await getDatabaseBackupQueue().add(
    DatabaseBackupJob.RunFullBackup,
    triggeredById ? { triggeredById } : {},
    { jobId },
  )
  logger.info('queue.database_backup.full_triggered', {
    component: 'Worker',
    triggeredById: triggeredById ?? null,
  })
  return jobId
}

/** Exclusão/restauração de workspace — ver `DatabaseBackupJob`. */
export async function enqueueAdminOperation(
  kind: 'delete' | 'restore',
  operationId: string,
): Promise<void> {
  await getDatabaseBackupQueue().add(
    kind === 'delete'
      ? DatabaseBackupJob.DeleteWorkspace
      : DatabaseBackupJob.RestoreWorkspace,
    { operationId },
    { jobId: `admin-op-${operationId}`, attempts: 1 },
  )
}
