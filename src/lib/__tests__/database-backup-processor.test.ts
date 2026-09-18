import { createHash } from 'node:crypto'
import type { Job } from 'bullmq'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  execFile: vi.fn(),
  mkdtemp: vi.fn(),
  readFile: vi.fn(),
  rm: vi.fn(),
  backup: {
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    findUnique: vi.fn(),
  },
  workspaceFindUnique: vi.fn(),
  encrypt: vi.fn(),
  ensureBucket: vi.fn(),
  putObject: vi.fn(),
  deleteObject: vi.fn(),
  getObject: vi.fn(),
  getOffsiteConfig: vi.fn(),
  pruneOffsiteObjects: vi.fn(),
  uploadAndVerifyOffsite: vi.fn(),
  queueAdd: vi.fn(),
  gatherWorkspaceData: vi.fn(),
  runWorkspaceDeletion: vi.fn(),
  runWorkspaceRestore: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  auditMutation: vi.fn(),
}))

vi.mock('node:child_process', () => ({ execFile: mocks.execFile }))
vi.mock('node:fs/promises', () => ({
  mkdtemp: mocks.mkdtemp,
  readFile: mocks.readFile,
  rm: mocks.rm,
}))
vi.mock('@/src/lib/prisma', () => ({
  prisma: {
    backup: mocks.backup,
    workspace: { findUnique: mocks.workspaceFindUnique },
  },
}))
vi.mock('@/src/lib/crypto', () => ({ encryptConnectionSecret: mocks.encrypt }))
vi.mock('@/src/lib/storage/s3', () => ({
  getObject: mocks.getObject,
  deleteObject: mocks.deleteObject,
  ensureBucket: mocks.ensureBucket,
  putObject: mocks.putObject,
}))
vi.mock('@/src/lib/storage/offsite-backup', () => ({
  getOffsiteConfig: mocks.getOffsiteConfig,
  uploadAndVerifyOffsite: mocks.uploadAndVerifyOffsite,
  pruneOffsiteObjects: mocks.pruneOffsiteObjects,
}))
vi.mock('@/src/lib/queue/queues', () => ({
  getDatabaseBackupQueue: () => ({ add: mocks.queueAdd }),
}))
vi.mock('@/src/lib/queue/workspace-snapshot', () => ({
  gatherWorkspaceData: mocks.gatherWorkspaceData,
}))
vi.mock('@/src/lib/queue/processors/admin-operations', () => ({
  runWorkspaceDeletion: mocks.runWorkspaceDeletion,
  runWorkspaceRestore: mocks.runWorkspaceRestore,
}))
vi.mock('@/lib/axiom/logger', () => ({ logger: mocks.logger }))
vi.mock('@/lib/axiom/audit', () => ({ auditMutation: mocks.auditMutation }))
vi.mock('@/lib/env/server', () => ({ DATABASE_URL: 'postgresql://db/steel' }))

import { DatabaseBackupJob } from '@/src/lib/queue/jobs'
import {
  BACKUP_BUCKET,
  backupWorkspace,
  processDatabaseBackup,
} from '@/src/lib/queue/processors/database-backup'

const CONFIG = { bucket: 'steel-offsite', prefix: 'steel/', retentionDays: 30 }

function job(
  name: string,
  data: Record<string, unknown> | undefined = {},
  id: string | null = 'job-1',
): Job {
  return { id: id ?? undefined, name, data, attemptsMade: 0 } as unknown as Job
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.execFile.mockImplementation(
    (
      _cmd: string,
      _args: string[],
      cb: (err: Error | null, out?: unknown) => void,
    ) => cb(null, { stdout: '', stderr: '' }),
  )
  mocks.mkdtemp.mockResolvedValue('/tmp/steel-backup-abc')
  mocks.readFile.mockResolvedValue(Buffer.from('PGDMP'))
  mocks.rm.mockResolvedValue(undefined)
  mocks.encrypt.mockResolvedValue('ciphertext')
  mocks.backup.create.mockResolvedValue({ id: 'bk-1' })
  mocks.backup.update.mockResolvedValue({})
  mocks.getOffsiteConfig.mockReturnValue(null)
})

describe('processDatabaseBackup — run-full-backup', () => {
  it('dumps, encrypts, uploads and completes the backup record', async () => {
    await processDatabaseBackup(
      job(DatabaseBackupJob.RunFullBackup, { triggeredById: 'admin-1' }),
    )

    expect(mocks.backup.create).toHaveBeenCalledWith({
      data: { scope: 'FULL', status: 'RUNNING', triggeredById: 'admin-1' },
    })
    expect(mocks.execFile).toHaveBeenCalledWith(
      'pg_dump',
      [
        '--format=custom',
        '--file',
        '/tmp/steel-backup-abc/full.dump',
        'postgresql://db/steel',
      ],
      expect.any(Function),
    )
    expect(mocks.encrypt).toHaveBeenCalledWith(
      Buffer.from('PGDMP').toString('base64'),
    )
    expect(mocks.ensureBucket).toHaveBeenCalledWith(BACKUP_BUCKET)
    expect(mocks.putObject).toHaveBeenCalledWith({
      bucket: BACKUP_BUCKET,
      key: 'full/bk-1.dump.enc',
      body: 'ciphertext',
      contentType: 'application/octet-stream',
    })
    const update = mocks.backup.update.mock.calls[0][0]
    expect(update.where).toEqual({ id: 'bk-1' })
    expect(update.data).toMatchObject({
      status: 'COMPLETED',
      storageKey: 'full/bk-1.dump.enc',
      sizeBytes: Buffer.byteLength('ciphertext'),
      checksum: createHash('sha256').update('PGDMP').digest('hex'),
    })
    expect(update.data.expiresAt.getTime()).toBeGreaterThan(Date.now())
    expect(mocks.auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'backup',
        action: 'create',
        targetId: 'bk-1',
      }),
    )
    // Offsite não configurado → só avisa, não enfileira a cópia.
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'queue.database_backup.offsite_not_configured',
      expect.objectContaining({ backupId: 'bk-1' }),
    )
    expect(mocks.queueAdd).not.toHaveBeenCalled()
    expect(mocks.rm).toHaveBeenCalledWith('/tmp/steel-backup-abc', {
      recursive: true,
      force: true,
    })
  })

  it('enqueues the offsite copy when offsite is configured', async () => {
    mocks.getOffsiteConfig.mockReturnValue(CONFIG)

    await processDatabaseBackup(job(DatabaseBackupJob.RunFullBackup, undefined))

    expect(mocks.backup.create).toHaveBeenCalledWith({
      data: { scope: 'FULL', status: 'RUNNING', triggeredById: null },
    })
    expect(mocks.queueAdd).toHaveBeenCalledWith(
      DatabaseBackupJob.CopyToOffsite,
      { backupId: 'bk-1' },
      { jobId: 'offsite-copy-bk-1' },
    )
  })

  it('marks the record FAILED, cleans the temp dir and rethrows when pg_dump fails', async () => {
    mocks.execFile.mockImplementation(
      (_c: string, _a: string[], cb: (err: Error | null) => void) =>
        cb(new Error('pg_dump: connection refused')),
    )

    await expect(
      processDatabaseBackup(job(DatabaseBackupJob.RunFullBackup)),
    ).rejects.toThrow('pg_dump: connection refused')

    expect(mocks.backup.update).toHaveBeenCalledWith({
      where: { id: 'bk-1' },
      data: {
        status: 'FAILED',
        errorMessage: 'pg_dump: connection refused',
        completedAt: expect.any(Date),
      },
    })
    expect(mocks.putObject).not.toHaveBeenCalled()
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'queue.database_backup.full_failed',
      expect.objectContaining({ backupId: 'bk-1' }),
    )
    expect(mocks.rm).toHaveBeenCalled()
  })

  it('stringifies non-Error failures', async () => {
    mocks.readFile.mockRejectedValue('disk gone')

    await expect(
      processDatabaseBackup(job(DatabaseBackupJob.RunFullBackup)),
    ).rejects.toBe('disk gone')
    expect(mocks.backup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ errorMessage: 'disk gone' }),
      }),
    )
  })
})

describe('backupWorkspace', () => {
  it('snapshots the workspace as encrypted JSON and completes the record', async () => {
    mocks.workspaceFindUnique.mockResolvedValue({ slug: 'acme' })
    mocks.gatherWorkspaceData.mockResolvedValue({ projects: [{ id: 'p1' }] })

    const result = await backupWorkspace({
      workspaceId: 'ws-1',
      triggeredById: 'admin-1',
      jobId: 'j-1',
    })

    expect(result).toEqual({
      backupId: 'bk-1',
      sizeBytes: Buffer.byteLength('ciphertext'),
    })
    expect(mocks.backup.create).toHaveBeenCalledWith({
      data: {
        scope: 'WORKSPACE',
        workspaceId: 'ws-1',
        workspaceSlug: 'acme',
        triggeredById: 'admin-1',
        status: 'RUNNING',
      },
    })
    const plain = Buffer.from(
      mocks.encrypt.mock.calls[0][0],
      'base64',
    ).toString('utf-8')
    expect(JSON.parse(plain)).toMatchObject({
      schemaVersion: 2,
      workspaceId: 'ws-1',
      data: { projects: [{ id: 'p1' }] },
    })
    expect(mocks.putObject).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'workspace/ws-1/bk-1.json.enc' }),
    )
    expect(mocks.auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'admin-1', targetId: 'bk-1' }),
    )
  })

  it('attributes system-triggered backups to "system"', async () => {
    mocks.workspaceFindUnique.mockResolvedValue({ slug: 'acme' })
    mocks.gatherWorkspaceData.mockResolvedValue({})

    await backupWorkspace({ workspaceId: 'ws-1' })

    expect(mocks.backup.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ triggeredById: null }),
    })
    expect(mocks.auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'system' }),
    )
  })

  it('records a FAILED backup and throws when the workspace does not exist', async () => {
    mocks.workspaceFindUnique.mockResolvedValue(null)

    await expect(backupWorkspace({ workspaceId: 'ghost' })).rejects.toThrow(
      'Workspace "ghost" não existe.',
    )
    expect(mocks.backup.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ workspaceSlug: null }),
    })
    expect(mocks.backup.update).toHaveBeenCalledWith({
      where: { id: 'bk-1' },
      data: {
        status: 'FAILED',
        errorMessage: 'Workspace "ghost" não existe.',
        completedAt: expect.any(Date),
      },
    })
    expect(mocks.gatherWorkspaceData).not.toHaveBeenCalled()
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'queue.database_backup.workspace_failed',
      expect.objectContaining({ workspaceId: 'ghost' }),
    )
  })

  it('stringifies non-Error failures while snapshotting', async () => {
    mocks.workspaceFindUnique.mockResolvedValue({ slug: 'acme' })
    mocks.gatherWorkspaceData.mockRejectedValue('snapshot broke')

    await expect(backupWorkspace({ workspaceId: 'ws-1' })).rejects.toBe(
      'snapshot broke',
    )
    expect(mocks.backup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ errorMessage: 'snapshot broke' }),
      }),
    )
  })
})

describe('processDatabaseBackup — routing', () => {
  it('runs a workspace backup job and returns the backup id', async () => {
    mocks.workspaceFindUnique.mockResolvedValue({ slug: 'acme' })
    mocks.gatherWorkspaceData.mockResolvedValue({})

    const result = await processDatabaseBackup(
      job(DatabaseBackupJob.RunWorkspaceBackup, {
        workspaceId: 'ws-1',
        triggeredById: 'admin-1',
      }),
    )

    expect(result).toEqual({ backupId: 'bk-1' })
  })

  it('delegates workspace deletion and restore to the admin operations', async () => {
    mocks.runWorkspaceDeletion.mockResolvedValue('deleted')
    mocks.runWorkspaceRestore.mockResolvedValue('restored')

    const deleteJob = job(DatabaseBackupJob.DeleteWorkspace, { a: 1 })
    const restoreJob = job(DatabaseBackupJob.RestoreWorkspace, { b: 2 })

    await expect(processDatabaseBackup(deleteJob)).resolves.toBe('deleted')
    await expect(processDatabaseBackup(restoreJob)).resolves.toBe('restored')
    expect(mocks.runWorkspaceDeletion).toHaveBeenCalledWith(deleteJob)
    expect(mocks.runWorkspaceRestore).toHaveBeenCalledWith(restoreJob)
  })

  it('throws on an unknown job name', async () => {
    await expect(processDatabaseBackup(job('nope', {}, null))).rejects.toThrow(
      'Unknown database-backup job: nope (id=unknown)',
    )
  })
})

describe('processDatabaseBackup — prune-expired-backups', () => {
  it('deletes expired objects and rows, then prunes offsite copies', async () => {
    mocks.backup.findMany.mockResolvedValue([
      { id: 'b1', storageKey: 'full/b1.dump.enc' },
      { id: 'b2', storageKey: null },
    ])
    mocks.getOffsiteConfig.mockReturnValue(CONFIG)
    mocks.pruneOffsiteObjects.mockResolvedValue(3)

    await processDatabaseBackup(job(DatabaseBackupJob.PruneExpiredBackups))

    expect(mocks.deleteObject).toHaveBeenCalledTimes(1)
    expect(mocks.deleteObject).toHaveBeenCalledWith({
      bucket: BACKUP_BUCKET,
      key: 'full/b1.dump.enc',
    })
    expect(mocks.backup.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['b1', 'b2'] } },
    })
    expect(mocks.logger.info).toHaveBeenCalledWith(
      'queue.database_backup.pruned',
      expect.objectContaining({ count: 2 }),
    )
    expect(mocks.logger.info).toHaveBeenCalledWith(
      'queue.database_backup.offsite_pruned',
      expect.objectContaining({ count: 3, retentionDays: 30 }),
    )
  })

  it('does not delete rows when nothing expired', async () => {
    mocks.backup.findMany.mockResolvedValue([])

    await processDatabaseBackup(job(DatabaseBackupJob.PruneExpiredBackups))

    expect(mocks.backup.deleteMany).not.toHaveBeenCalled()
    expect(mocks.pruneOffsiteObjects).not.toHaveBeenCalled()
  })

  it('logs and rethrows offsite prune failures', async () => {
    mocks.backup.findMany.mockResolvedValue([])
    mocks.getOffsiteConfig.mockReturnValue(CONFIG)
    mocks.pruneOffsiteObjects.mockRejectedValueOnce(new Error('s3 403'))

    await expect(
      processDatabaseBackup(job(DatabaseBackupJob.PruneExpiredBackups)),
    ).rejects.toThrow('s3 403')
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'queue.database_backup.offsite_prune_failed',
      { component: 'Worker', message: 's3 403' },
    )

    mocks.pruneOffsiteObjects.mockRejectedValueOnce('raw')
    await expect(
      processDatabaseBackup(job(DatabaseBackupJob.PruneExpiredBackups)),
    ).rejects.toBe('raw')
    expect(mocks.logger.error).toHaveBeenLastCalledWith(
      'queue.database_backup.offsite_prune_failed',
      { component: 'Worker', message: 'raw' },
    )
  })
})

describe('processDatabaseBackup — copy-to-offsite edge cases', () => {
  it('reports a missing backup as backup_not_found', async () => {
    mocks.getOffsiteConfig.mockReturnValue(CONFIG)
    mocks.backup.findUnique.mockResolvedValue(null)

    await processDatabaseBackup(
      job(DatabaseBackupJob.CopyToOffsite, { backupId: 'ghost' }),
    )

    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'queue.database_backup.offsite_skipped',
      expect.objectContaining({ reason: 'backup_not_found' }),
    )
    expect(mocks.getObject).not.toHaveBeenCalled()
  })

  it('skips completed backups without a storage key', async () => {
    mocks.getOffsiteConfig.mockReturnValue(CONFIG)
    mocks.backup.findUnique.mockResolvedValue({
      id: 'b1',
      status: 'COMPLETED',
      storageKey: null,
    })

    await processDatabaseBackup(
      job(DatabaseBackupJob.CopyToOffsite, { backupId: 'b1' }),
    )

    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'queue.database_backup.offsite_skipped',
      expect.objectContaining({ reason: 'status COMPLETED' }),
    )
  })

  it('stringifies non-Error upload failures before rethrowing', async () => {
    mocks.getOffsiteConfig.mockReturnValue(CONFIG)
    mocks.backup.findUnique.mockResolvedValue({
      id: 'b1',
      status: 'COMPLETED',
      storageKey: 'full/b1.dump.enc',
      checksum: 'abc',
    })
    mocks.getObject.mockResolvedValue(Buffer.from('enc'))
    mocks.uploadAndVerifyOffsite.mockRejectedValue('checksum mismatch')

    await expect(
      processDatabaseBackup(
        job(DatabaseBackupJob.CopyToOffsite, { backupId: 'b1' }),
      ),
    ).rejects.toBe('checksum mismatch')
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'queue.database_backup.offsite_failed',
      expect.objectContaining({ message: 'checksum mismatch' }),
    )
  })
})
