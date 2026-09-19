import { prisma } from '@/src/lib/prisma'
import { fetchAndDecryptBackup } from '@/src/lib/queue/database-restore'
import {
  readWorkspaceFilesManifest,
  restoreWorkspaceFiles,
} from '@/src/lib/queue/workspace-file-archive'
import {
  restoreWorkspaceSnapshot,
  type WorkspaceSnapshot,
} from '@/src/lib/queue/workspace-snapshot'

const USAGE =
  'Uso: pnpm restore:workspace <backupId> [--dry-run] [--skip-files] [--files-only]'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(1)} ${units[unit]}`
}

/**
 * Restaura um backup WORKSPACE: apaga o estado atual do workspace (cascata)
 * e recria a partir do snapshot numa única transação, e depois regrava no
 * MinIO os arquivos do manifesto. O painel admin (/admin/backups) faz o
 * mesmo via job, com backup de segurança antes.
 *
 *   pnpm restore:workspace <backupId> [--dry-run] [--skip-files] [--files-only]
 *
 * - `--dry-run`    não escreve nada: só mostra o que seria restaurado.
 * - `--skip-files` restaura só as linhas.
 * - `--files-only` restaura só os arquivos (útil para reprocessar um restore
 *   cujo passo de arquivos falhou — o `putObject` sobrescreve as mesmas
 *   chaves e não encosta em nenhum outro objeto).
 */
async function main() {
  const args = process.argv.slice(2)
  const backupId = args.find((arg) => !arg.startsWith('--'))
  const dryRun = args.includes('--dry-run')
  const skipFiles = args.includes('--skip-files')
  const filesOnly = args.includes('--files-only')

  if (!backupId) {
    console.error(USAGE)
    process.exitCode = 1
    return
  }
  if (skipFiles && filesOnly) {
    console.error('--skip-files e --files-only são mutuamente exclusivos.')
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
  const manifest =
    skipFiles || !backup.filesKey
      ? null
      : await readWorkspaceFilesManifest(backup.filesKey)

  if (dryRun) {
    const tables = Object.entries(snapshot.data).filter(
      ([, value]) => Array.isArray(value) && value.length > 0,
    ) as [string, unknown[]][]
    const rows = tables.reduce((sum, [, value]) => sum + value.length, 0)
    console.log(`[dry-run] Workspace ${snapshot.workspaceId}`)
    if (!filesOnly) {
      console.log(`[dry-run] Banco: ${tables.length} tabelas, ${rows} linhas`)
    }
    if (manifest) {
      const plan = await restoreWorkspaceFiles({ manifest, dryRun: true })
      console.log(
        `[dry-run] Arquivos: ${plan.planned} objetos, ${formatBytes(plan.bytes)}`,
      )
      for (const [bucket, stats] of Object.entries(plan.byBucket)) {
        console.log(
          `[dry-run]   ${bucket}: ${stats.files} objeto(s), ${formatBytes(stats.bytes)}`,
        )
      }
      const legacy = manifest.files.filter((file) => file.legacy).length
      if (legacy > 0) {
        console.log(
          `[dry-run]   ${legacy} objeto(s) legado(s), achados por referência`,
        )
      }
      if (manifest.missingLegacyKeys > 0) {
        console.log(
          `[dry-run]   ${manifest.missingLegacyKeys} referência(s) legada(s) já não existiam no backup`,
        )
      }
    } else if (!skipFiles) {
      console.log('[dry-run] Arquivos: backup sem manifesto (só banco)')
    }
    console.log('[dry-run] Nada foi alterado.')
    return
  }

  const parts: string[] = []
  if (!filesOnly) {
    const { tables, rows } = await restoreWorkspaceSnapshot(prisma, snapshot)
    parts.push(`${tables} tabelas, ${rows} linhas`)
  }
  if (manifest) {
    const files = await restoreWorkspaceFiles({ manifest })
    parts.push(`${files.restored} arquivos (${formatBytes(files.bytes)})`)
  } else if (!skipFiles) {
    parts.push('sem arquivos no backup')
  }

  const elapsedMs = Date.now() - startedAt
  console.log(
    `Workspace "${snapshot.workspaceId}" restaurado em ${elapsedMs}ms (${parts.join(', ')}).`,
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
