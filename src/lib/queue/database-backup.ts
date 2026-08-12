import { logger } from '@/lib/axiom/logger'
import { DatabaseBackupJob } from './jobs'
import { getDatabaseBackupQueue } from './queues'

export async function triggerWorkspaceBackup(
  workspaceId: string,
): Promise<void> {
  const queue = getDatabaseBackupQueue()

  await queue.add(
    DatabaseBackupJob.RunWorkspaceBackup,
    { workspaceId },
    { jobId: `workspace-backup-${workspaceId}-${Date.now()}` },
  )

  logger.info('queue.database_backup.workspace_triggered', {
    component: 'Worker',
    workspaceId,
  })
}
