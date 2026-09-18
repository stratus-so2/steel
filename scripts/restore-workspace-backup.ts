import { prisma } from '@/src/lib/prisma'
import { fetchAndDecryptBackup } from '@/src/lib/queue/database-restore'
import {
  restoreWorkspaceSnapshot,
  type WorkspaceSnapshot,
} from '@/src/lib/queue/workspace-snapshot'

/**
 * Restaura um backup WORKSPACE: apaga o estado atual do workspace (cascata)
 * e recria a partir do snapshot, numa única transação. O painel admin
 * (/admin/backups) faz o mesmo via job, com backup de segurança antes.
 *
 *   pnpm restore:workspace <backupId>
 */
async function main() {
  const backupId = process.argv[2]
  if (!backupId) {
    console.error('Uso: pnpm restore:workspace <backupId>')
    process.exitCode = 1
    return
  }

  const startedAt = Date.now()
  const { buffer, backup } = await fetchAndDecryptBackup(backupId)
  if (backup.scope !== 'WORKSPACE') {
    throw new Error(
      `Backup "${backupId}" não é WORKSPACE (scope: ${backup.scope}).`,
    )
  }

  const snapshot = JSON.parse(buffer.toString('utf-8')) as WorkspaceSnapshot
  const { tables, rows } = await restoreWorkspaceSnapshot(prisma, snapshot)

  const elapsedMs = Date.now() - startedAt
  console.log(
    `Workspace "${snapshot.workspaceId}" restaurado em ${elapsedMs}ms (${tables} tabelas, ${rows} linhas).`,
  )
}

function redact(message: string): string {
  return message.replace(/:\/\/([^:/@\s]+):([^@/\s]+)@/g, '://$1:****@')
}

main()
  .catch((error) => {
    const message =
      error instanceof Error ? (error.stack ?? error.message) : String(error)
    console.error(redact(message))
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
