import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { DATABASE_URL } from '@/lib/env/server'
import { prisma } from '@/src/lib/prisma'
import {
  fetchAndDecryptBackup,
  fetchAndDecryptOffsiteBackup,
} from '@/src/lib/queue/database-restore'
import {
  getOffsiteConfig,
  listOffsiteObjects,
} from '@/src/lib/storage/offsite-backup'

const execFileAsync = promisify(execFile)

function redact(message: string): string {
  return message.replace(/:\/\/([^:/@\s]+):([^@/\s]+)@/g, '://$1:****@')
}

async function hasLocalPgRestore(): Promise<boolean> {
  try {
    await execFileAsync('pg_restore', ['--version'])
    return true
  } catch {
    return false
  }
}

async function runPgRestore(dumpPath: string, target: string): Promise<void> {
  const args = [
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-acl',
    '-d',
    target,
  ]

  if (await hasLocalPgRestore()) {
    await execFileAsync('pg_restore', [...args, dumpPath])
    return
  }

  // pg_restore não instalado localmente — usa a mesma major version do
  // Postgres via Docker (não roda no host de produção, só em máquinas
  // de operador sem o cliente instalado).
  const dir = dumpPath.slice(0, dumpPath.lastIndexOf('/'))
  await execFileAsync('docker', [
    'run',
    '--rm',
    '--network',
    'host',
    '-v',
    `${dir}:/work`,
    'postgres:17-alpine',
    'pg_restore',
    ...args,
    '/work/restore.dump',
  ])
}

/**
 * Restaura um backup FULL num banco de destino. Por padrão usa DATABASE_URL
 * — passe --target pra restaurar em outro banco (ex: um banco descartável
 * de teste, pra não sobrescrever o banco em uso).
 *
 *   pnpm restore:full <backupId> [--target=<databaseUrl>]
 *
 * Com `--offsite`, lê a cópia do storage externo (BACKUP_OFFSITE_*) em vez do
 * MinIO local, sem depender da tabela `backups` — é o caminho quando o
 * servidor/banco original se perdeu. `--list-offsite` lista as cópias.
 *
 *   pnpm restore:full --list-offsite
 *   pnpm restore:full <backupId> --offsite [--target=<databaseUrl>]
 */
const USAGE =
  'Uso: pnpm restore:full <backupId> [--offsite] [--target=<databaseUrl>]\n' +
  '     pnpm restore:full --list-offsite'

async function listOffsite(): Promise<void> {
  const config = getOffsiteConfig()
  if (!config) {
    throw new Error('Cópia offsite não configurada (BACKUP_OFFSITE_*).')
  }
  const items = await listOffsiteObjects(config)
  if (items.length === 0) {
    console.log('Nenhuma cópia offsite encontrada.')
    return
  }
  for (const item of items) {
    const id = /^full\/(.+)\.dump\.enc$/.exec(item.key)?.[1] ?? item.key
    const mb = (item.sizeBytes / 1024 / 1024).toFixed(1)
    console.log(`${item.lastModified?.toISOString() ?? '?'}  ${mb} MB  ${id}`)
  }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--list-offsite')) {
    await listOffsite()
    return
  }

  const backupId = args.find((arg) => !arg.startsWith('--'))
  const offsite = args.includes('--offsite')
  const targetArg = args.find((arg) => arg.startsWith('--target='))
  const target = targetArg ? targetArg.slice('--target='.length) : DATABASE_URL

  if (!backupId || !target) {
    console.error(USAGE)
    process.exitCode = 1
    return
  }

  const startedAt = Date.now()
  let buffer: Buffer
  if (offsite) {
    const result = await fetchAndDecryptOffsiteBackup(backupId)
    console.log(`Cópia offsite "${result.key}" baixada e verificada.`)
    buffer = result.buffer
  } else {
    const result = await fetchAndDecryptBackup(backupId)
    if (result.backup.scope !== 'FULL') {
      throw new Error(
        `Backup "${backupId}" não é FULL (scope: ${result.backup.scope}).`,
      )
    }
    buffer = result.buffer
  }

  const dir = await mkdtemp(join(tmpdir(), 'steel-restore-'))
  const dumpPath = join(dir, 'restore.dump')
  await writeFile(dumpPath, buffer)

  try {
    await runPgRestore(dumpPath, target)
    const elapsedMs = Date.now() - startedAt
    console.log(`Restore completo em ${elapsedMs}ms.`)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

main()
  .catch((error) => {
    const message =
      error instanceof Error ? (error.stack ?? error.message) : String(error)
    console.error(redact(message))
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
