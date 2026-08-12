import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { prisma } from '@/src/lib/prisma'
import { fetchAndDecryptBackup } from '@/src/lib/queue/database-restore'

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
 */
async function main() {
  const backupId = process.argv[2]
  const targetArg = process.argv.find((arg) => arg.startsWith('--target='))
  const target = targetArg
    ? targetArg.slice('--target='.length)
    : process.env.DATABASE_URL

  if (!backupId || !target) {
    console.error('Uso: pnpm restore:full <backupId> [--target=<databaseUrl>]')
    process.exitCode = 1
    return
  }

  const startedAt = Date.now()
  const { buffer, backup } = await fetchAndDecryptBackup(backupId)
  if (backup.scope !== 'FULL') {
    throw new Error(`Backup "${backupId}" não é FULL (scope: ${backup.scope}).`)
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
