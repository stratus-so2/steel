import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { Job } from 'bullmq'
import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import { DATABASE_URL } from '@/lib/env/server'
import { encryptConnectionSecret } from '@/src/lib/crypto'
import { prisma } from '@/src/lib/prisma'
import {
  getOffsiteConfig,
  pruneOffsiteObjects,
  uploadAndVerifyOffsite,
} from '@/src/lib/storage/offsite-backup'
import {
  deleteObject,
  ensureBucket,
  getObject,
  putObject,
} from '@/src/lib/storage/s3'
import { DatabaseBackupJob, type DatabaseBackupJobPayload } from '../jobs'
import { getDatabaseBackupQueue } from '../queues'
import { BackupRetentionDays } from '../retention'
import { gatherWorkspaceData } from '../workspace-snapshot'
import { runWorkspaceDeletion, runWorkspaceRestore } from './admin-operations'

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

function warnOffsiteDisabled(context: Record<string, unknown>): void {
  logger.warn('queue.database_backup.offsite_not_configured', {
    component: 'Worker',
    message:
      'BACKUP_OFFSITE_* não configurado — backup existe só no MinIO do próprio servidor',
    ...context,
  })
}

/**
 * Job separado (e não um passo do full backup) pra que uma falha no provedor
 * externo seja reprocessada sozinha pelo retry do BullMQ, sem refazer o
 * pg_dump nem marcar o backup local como FAILED.
 */
async function enqueueOffsiteCopy(backupId: string): Promise<void> {
  if (!getOffsiteConfig()) {
    warnOffsiteDisabled({ backupId })
    return
  }
  await getDatabaseBackupQueue().add(
    DatabaseBackupJob.CopyToOffsite,
    { backupId },
    { jobId: `offsite-copy-${backupId}` },
  )
}

async function runCopyToOffsite(
  job: Job<DatabaseBackupJobPayload[typeof DatabaseBackupJob.CopyToOffsite]>,
): Promise<void> {
  const config = getOffsiteConfig()
  if (!config) {
    warnOffsiteDisabled({ jobId: job.id, backupId: job.data.backupId })
    return
  }

  const { backupId } = job.data
  const backup = await prisma.backup.findUnique({ where: { id: backupId } })
  if (!backup || backup.status !== 'COMPLETED' || !backup.storageKey) {
    logger.warn('queue.database_backup.offsite_skipped', {
      component: 'Worker',
      jobId: job.id,
      backupId,
      reason: backup ? `status ${backup.status}` : 'backup_not_found',
    })
    return
  }

  try {
    const body = await getObject({
      bucket: BACKUP_BUCKET,
      key: backup.storageKey,
    })
    const result = await uploadAndVerifyOffsite(config, {
      key: backup.storageKey,
      body,
      plainChecksum: backup.checksum,
    })

    // O painel mostra onde cada backup está; sem isto a cópia offsite só
    // seria visível listando o bucket externo.
    await prisma.backup.update({
      where: { id: backupId },
      data: { offsiteKey: result.key, offsiteCopiedAt: new Date() },
    })

    auditMutation({
      entity: 'backup',
      action: 'update',
      actorId: 'system',
      targetId: backupId,
      meta: {
        offsiteKey: result.key,
        offsiteSizeBytes: result.sizeBytes,
        jobId: job.id,
      },
    })

    logger.info('queue.database_backup.offsite_completed', {
      component: 'Worker',
      jobId: job.id,
      backupId,
      offsiteKey: result.key,
      sizeBytes: result.sizeBytes,
      verified: true,
    })
  } catch (error) {
    logger.error('queue.database_backup.offsite_failed', {
      component: 'Worker',
      jobId: job.id,
      backupId,
      attemptsMade: job.attemptsMade,
      message: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

async function runFullBackup(
  job: Job<DatabaseBackupJobPayload[typeof DatabaseBackupJob.RunFullBackup]>,
): Promise<void> {
  const triggeredById = job.data?.triggeredById ?? null
  const record = await prisma.backup.create({
    data: { scope: 'FULL', status: 'RUNNING', triggeredById },
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
      meta: { scope: 'FULL', sizeBytes, jobId: job.id, triggeredById },
    })

    logger.info('queue.database_backup.full_completed', {
      component: 'Worker',
      jobId: job.id,
      backupId: record.id,
      sizeBytes,
    })

    await enqueueOffsiteCopy(record.id)
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

/**
 * Backup lógico de um workspace (JSON cifrado). Exportado porque a exclusão
 * definitiva (`delete-workspace`) e o restore reaproveitam exatamente este
 * passo antes de mexer nos dados. Lança em falha, com o registro já FAILED.
 */
export async function backupWorkspace(params: {
  workspaceId: string
  triggeredById?: string | null
  jobId?: string
}): Promise<{ backupId: string; sizeBytes: number }> {
  const { workspaceId, jobId } = params
  const triggeredById = params.triggeredById ?? null

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { slug: true },
  })

  const record = await prisma.backup.create({
    data: {
      scope: 'WORKSPACE',
      workspaceId,
      workspaceSlug: workspace?.slug ?? null,
      triggeredById,
      status: 'RUNNING',
    },
  })

  try {
    if (!workspace) throw new Error(`Workspace "${workspaceId}" não existe.`)

    const data = await gatherWorkspaceData(prisma, workspaceId)
    const buffer = Buffer.from(
      JSON.stringify({
        schemaVersion: 2,
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
      actorId: triggeredById ?? 'system',
      targetId: record.id,
      meta: { scope: 'WORKSPACE', workspaceId, sizeBytes, jobId },
    })

    logger.info('queue.database_backup.workspace_completed', {
      component: 'Worker',
      jobId,
      backupId: record.id,
      workspaceId,
      sizeBytes,
    })
    return { backupId: record.id, sizeBytes }
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
      jobId,
      backupId: record.id,
      workspaceId,
      message,
    })
    throw error
  }
}

async function runWorkspaceBackup(
  job: Job<
    DatabaseBackupJobPayload[typeof DatabaseBackupJob.RunWorkspaceBackup]
  >,
): Promise<{ backupId: string }> {
  const { backupId } = await backupWorkspace({
    workspaceId: job.data.workspaceId,
    triggeredById: job.data.triggeredById,
    jobId: job.id,
  })
  return { backupId }
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

  const offsite = getOffsiteConfig()
  if (!offsite) return

  try {
    const offsiteCount = await pruneOffsiteObjects(offsite)
    logger.info('queue.database_backup.offsite_pruned', {
      component: 'Worker',
      count: offsiteCount,
      retentionDays: offsite.retentionDays,
    })
  } catch (error) {
    logger.error('queue.database_backup.offsite_prune_failed', {
      component: 'Worker',
      message: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function processDatabaseBackup(job: Job): Promise<unknown> {
  switch (job.name) {
    case DatabaseBackupJob.RunFullBackup:
      return runFullBackup(job)
    case DatabaseBackupJob.DeleteWorkspace:
      return runWorkspaceDeletion(
        job as Job<
          DatabaseBackupJobPayload[typeof DatabaseBackupJob.DeleteWorkspace]
        >,
      )
    case DatabaseBackupJob.RestoreWorkspace:
      return runWorkspaceRestore(
        job as Job<
          DatabaseBackupJobPayload[typeof DatabaseBackupJob.RestoreWorkspace]
        >,
      )
    case DatabaseBackupJob.RunWorkspaceBackup:
      return runWorkspaceBackup(
        job as Job<
          DatabaseBackupJobPayload[typeof DatabaseBackupJob.RunWorkspaceBackup]
        >,
      )
    case DatabaseBackupJob.PruneExpiredBackups:
      return pruneExpiredBackups()
    case DatabaseBackupJob.CopyToOffsite:
      return runCopyToOffsite(
        job as Job<
          DatabaseBackupJobPayload[typeof DatabaseBackupJob.CopyToOffsite]
        >,
      )
    default:
      throw new Error(
        `Unknown database-backup job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
