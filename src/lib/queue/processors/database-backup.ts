import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { Prisma } from '@prisma/client'
import type { Job } from 'bullmq'
import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import { DATABASE_URL } from '@/lib/env/server'
import { encryptConnectionSecret } from '@/src/lib/crypto'
import { prisma } from '@/src/lib/prisma'
import { deleteObject, ensureBucket, putObject } from '@/src/lib/storage/s3'
import { DatabaseBackupJob, type DatabaseBackupJobPayload } from '../jobs'
import { BackupRetentionDays } from '../retention'

const execFileAsync = promisify(execFile)

export const BACKUP_BUCKET = 'database-backups'

async function uploadEncrypted(params: {
  key: string
  buffer: Buffer
}): Promise<{ sizeBytes: number; checksum: string }> {
  const checksum = createHash('sha256').update(params.buffer).digest('hex')
  const encrypted = await encryptConnectionSecret(
    params.buffer.toString('base64'),
  )

  await ensureBucket(BACKUP_BUCKET)
  await putObject({
    bucket: BACKUP_BUCKET,
    key: params.key,
    body: encrypted,
    contentType: 'application/octet-stream',
  })

  return { sizeBytes: Buffer.byteLength(encrypted, 'utf-8'), checksum }
}

function expiresAt(): Date {
  return new Date(Date.now() + BackupRetentionDays * 24 * 60 * 60 * 1000)
}

async function runFullBackup(job: Job): Promise<void> {
  const record = await prisma.backup.create({
    data: { scope: 'FULL', status: 'RUNNING' },
  })

  const dir = await mkdtemp(join(tmpdir(), 'steel-backup-'))
  const dumpPath = join(dir, 'full.dump')

  try {
    await execFileAsync('pg_dump', [
      '--format=custom',
      '--file',
      dumpPath,
      DATABASE_URL,
    ])

    const buffer = await readFile(dumpPath)
    const key = `full/${record.id}.dump.enc`
    const { sizeBytes, checksum } = await uploadEncrypted({ key, buffer })

    await prisma.backup.update({
      where: { id: record.id },
      data: {
        status: 'COMPLETED',
        storageKey: key,
        sizeBytes,
        checksum,
        completedAt: new Date(),
        expiresAt: expiresAt(),
      },
    })

    auditMutation({
      entity: 'backup',
      action: 'create',
      actorId: 'system',
      targetId: record.id,
      meta: { scope: 'FULL', sizeBytes, jobId: job.id },
    })

    logger.info('queue.database_backup.full_completed', {
      component: 'Worker',
      jobId: job.id,
      backupId: record.id,
      sizeBytes,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await prisma.backup.update({
      where: { id: record.id },
      data: {
        status: 'FAILED',
        errorMessage: message,
        completedAt: new Date(),
      },
    })
    logger.error('queue.database_backup.full_failed', {
      component: 'Worker',
      jobId: job.id,
      backupId: record.id,
      message,
    })
    throw error
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

function workspaceScopedDelegates(): string[] {
  return Prisma.dmmf.datamodel.models
    .filter(
      (model) =>
        model.name !== 'Backup' &&
        model.fields.some((field) => field.name === 'workspaceId'),
    )
    .map((model) => model.name.charAt(0).toLowerCase() + model.name.slice(1))
}

type FindManyDelegate = {
  findMany: (args: { where: { workspaceId: string } }) => Promise<unknown[]>
}

async function gatherWorkspaceData(
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  })
  if (!workspace) return { workspace: null }

  const data: Record<string, unknown> = { workspace }
  const client = prisma as unknown as Record<string, FindManyDelegate>

  for (const delegateName of workspaceScopedDelegates()) {
    const delegate = client[delegateName]
    if (!delegate?.findMany) continue
    data[delegateName] = await delegate.findMany({ where: { workspaceId } })
  }

  return data
}

async function runWorkspaceBackup(
  job: Job<
    DatabaseBackupJobPayload[typeof DatabaseBackupJob.RunWorkspaceBackup]
  >,
): Promise<void> {
  const { workspaceId } = job.data

  const record = await prisma.backup.create({
    data: { scope: 'WORKSPACE', workspaceId, status: 'RUNNING' },
  })

  try {
    const data = await gatherWorkspaceData(workspaceId)
    const buffer = Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        workspaceId,
        data,
      }),
      'utf-8',
    )
    const key = `workspace/${workspaceId}/${record.id}.json.enc`
    const { sizeBytes, checksum } = await uploadEncrypted({ key, buffer })

    await prisma.backup.update({
      where: { id: record.id },
      data: {
        status: 'COMPLETED',
        storageKey: key,
        sizeBytes,
        checksum,
        completedAt: new Date(),
        expiresAt: expiresAt(),
      },
    })

    auditMutation({
      entity: 'backup',
      action: 'create',
      actorId: 'system',
      targetId: record.id,
      meta: { scope: 'WORKSPACE', workspaceId, sizeBytes, jobId: job.id },
    })

    logger.info('queue.database_backup.workspace_completed', {
      component: 'Worker',
      jobId: job.id,
      backupId: record.id,
      workspaceId,
      sizeBytes,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await prisma.backup.update({
      where: { id: record.id },
      data: {
        status: 'FAILED',
        errorMessage: message,
        completedAt: new Date(),
      },
    })
    logger.error('queue.database_backup.workspace_failed', {
      component: 'Worker',
      jobId: job.id,
      backupId: record.id,
      workspaceId,
      message,
    })
    throw error
  }
}

async function pruneExpiredBackups(): Promise<void> {
  const expired = await prisma.backup.findMany({
    where: { expiresAt: { lt: new Date() } },
  })

  for (const backup of expired) {
    if (backup.storageKey) {
      await deleteObject({ bucket: BACKUP_BUCKET, key: backup.storageKey })
    }
  }

  if (expired.length > 0) {
    await prisma.backup.deleteMany({
      where: { id: { in: expired.map((b) => b.id) } },
    })
  }

  logger.info('queue.database_backup.pruned', {
    component: 'Worker',
    count: expired.length,
  })
}

export async function processDatabaseBackup(job: Job): Promise<void> {
  switch (job.name) {
    case DatabaseBackupJob.RunFullBackup:
      return runFullBackup(job)
    case DatabaseBackupJob.RunWorkspaceBackup:
      return runWorkspaceBackup(
        job as Job<
          DatabaseBackupJobPayload[typeof DatabaseBackupJob.RunWorkspaceBackup]
        >,
      )
    case DatabaseBackupJob.PruneExpiredBackups:
      return pruneExpiredBackups()
    default:
      throw new Error(
        `Unknown database-backup job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
