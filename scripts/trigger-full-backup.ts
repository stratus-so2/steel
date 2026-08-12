import { DatabaseBackupJob } from '@/src/lib/queue/jobs'
import { closeQueues, getDatabaseBackupQueue } from '@/src/lib/queue/queues'

/**
 * Enfileira um backup completo do banco fora do cron das 03:15. O worker
 * processa o job de forma assíncrona — acompanhe pela tabela `backups`.
 *
 *   pnpm backup:full
 */
async function main() {
  const queue = getDatabaseBackupQueue()
  await queue.add(DatabaseBackupJob.RunFullBackup, {})
  console.log('Backup completo enfileirado. Acompanhe pela tabela `backups`.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => closeQueues())
