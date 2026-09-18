import type { Job } from 'bullmq'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  getObject: vi.fn(),
  getOffsiteConfig: vi.fn(),
  uploadAndVerifyOffsite: vi.fn(),
  pruneOffsiteObjects: vi.fn(),
  queueAdd: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  auditMutation: vi.fn(),
}))

vi.mock('@/src/lib/prisma', () => ({
  prisma: {
    backup: {
      findUnique: mocks.findUnique,
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn(),
    },
  },
}))
vi.mock('@/src/lib/storage/s3', () => ({
  getObject: mocks.getObject,
  deleteObject: vi.fn(),
  ensureBucket: vi.fn(),
  putObject: vi.fn(),
}))
vi.mock('@/src/lib/storage/offsite-backup', () => ({
  getOffsiteConfig: mocks.getOffsiteConfig,
  uploadAndVerifyOffsite: mocks.uploadAndVerifyOffsite,
  pruneOffsiteObjects: mocks.pruneOffsiteObjects,
}))
vi.mock('@/src/lib/queue/queues', () => ({
  getDatabaseBackupQueue: () => ({ add: mocks.queueAdd }),
}))
vi.mock('@/src/lib/crypto', () => ({ encryptConnectionSecret: vi.fn() }))
vi.mock('@/lib/axiom/logger', () => ({ logger: mocks.logger }))
vi.mock('@/lib/axiom/audit', () => ({ auditMutation: mocks.auditMutation }))
vi.mock('@/lib/env/server', () => ({ DATABASE_URL: 'postgresql://x' }))

import { processDatabaseBackup } from '@/src/lib/queue/processors/database-backup'

const CONFIG = { bucket: 'steel-offsite', prefix: 'steel/', retentionDays: 90 }

function copyJob(backupId = 'b1'): Job {
  return {
    id: 'job-1',
    name: 'copy-to-offsite',
    data: { backupId },
    attemptsMade: 0,
  } as unknown as Job
}

describe('processDatabaseBackup — copy-to-offsite', () => {
  it('is inert (warns, no upload) when offsite is not configured', async () => {
    mocks.getOffsiteConfig.mockReturnValue(null)

    await processDatabaseBackup(copyJob())

    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'queue.database_backup.offsite_not_configured',
      expect.any(Object),
    )
    expect(mocks.findUnique).not.toHaveBeenCalled()
    expect(mocks.uploadAndVerifyOffsite).not.toHaveBeenCalled()
  })

  it('copies the encrypted MinIO object offsite and logs verification', async () => {
    mocks.getOffsiteConfig.mockReturnValue(CONFIG)
    mocks.findUnique.mockResolvedValue({
      id: 'b1',
      status: 'COMPLETED',
      storageKey: 'full/b1.dump.enc',
      checksum: 'plain-sha',
    })
    const body = Buffer.from('envelope')
    mocks.getObject.mockResolvedValue(body)
    mocks.uploadAndVerifyOffsite.mockResolvedValue({
      key: 'steel/full/b1.dump.enc',
      sizeBytes: body.length,
      encryptedChecksum: 'enc-sha',
    })

    await processDatabaseBackup(copyJob())

    expect(mocks.getObject).toHaveBeenCalledWith({
      bucket: 'database-backups',
      key: 'full/b1.dump.enc',
    })
    expect(mocks.uploadAndVerifyOffsite).toHaveBeenCalledWith(CONFIG, {
      key: 'full/b1.dump.enc',
      body,
      plainChecksum: 'plain-sha',
    })
    expect(mocks.logger.info).toHaveBeenCalledWith(
      'queue.database_backup.offsite_completed',
      expect.objectContaining({ backupId: 'b1', verified: true }),
    )
  })

  it('skips backups that are not COMPLETED', async () => {
    mocks.getOffsiteConfig.mockReturnValue(CONFIG)
    mocks.findUnique.mockResolvedValue({
      id: 'b1',
      status: 'FAILED',
      storageKey: null,
      checksum: null,
    })

    await processDatabaseBackup(copyJob())

    expect(mocks.uploadAndVerifyOffsite).not.toHaveBeenCalled()
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'queue.database_backup.offsite_skipped',
      expect.any(Object),
    )
  })

  it('rethrows upload/verification failures so BullMQ retries the copy', async () => {
    mocks.getOffsiteConfig.mockReturnValue(CONFIG)
    mocks.findUnique.mockResolvedValue({
      id: 'b1',
      status: 'COMPLETED',
      storageKey: 'full/b1.dump.enc',
      checksum: 'plain-sha',
    })
    mocks.getObject.mockResolvedValue(Buffer.from('envelope'))
    mocks.uploadAndVerifyOffsite.mockRejectedValue(
      new Error('Offsite verification failed'),
    )

    await expect(processDatabaseBackup(copyJob())).rejects.toThrow(
      /verification failed/,
    )
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'queue.database_backup.offsite_failed',
      expect.objectContaining({ backupId: 'b1' }),
    )
  })
})

describe('processDatabaseBackup — prune-expired-backups', () => {
  it('also prunes offsite copies when configured', async () => {
    mocks.getOffsiteConfig.mockReturnValue(CONFIG)
    mocks.pruneOffsiteObjects.mockResolvedValue(2)

    await processDatabaseBackup({
      id: 'job-2',
      name: 'prune-expired-backups',
      data: {},
    } as unknown as Job)

    expect(mocks.pruneOffsiteObjects).toHaveBeenCalledWith(CONFIG)
    expect(mocks.logger.info).toHaveBeenCalledWith(
      'queue.database_backup.offsite_pruned',
      expect.objectContaining({ count: 2, retentionDays: 90 }),
    )
  })

  it('skips offsite pruning when not configured', async () => {
    mocks.getOffsiteConfig.mockReturnValue(null)

    await processDatabaseBackup({
      id: 'job-3',
      name: 'prune-expired-backups',
      data: {},
    } as unknown as Job)

    expect(mocks.pruneOffsiteObjects).not.toHaveBeenCalled()
  })
})
