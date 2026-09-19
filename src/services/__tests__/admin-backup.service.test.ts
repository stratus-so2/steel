import type { Backup } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeUser } from '@/src/__tests__/factories/user.factory'
import { createFakeWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))
vi.mock('@/src/repositories/user.repository')
vi.mock('@/src/repositories/workspace.repository')
vi.mock('@/src/repositories/backup.repository')
vi.mock('@/src/repositories/admin-operation.repository')
vi.mock('@/src/lib/queue/database-backup', () => ({
  enqueueAdminOperation: vi.fn(),
  triggerFullBackup: vi.fn(async () => 'job-full'),
  triggerWorkspaceBackup: vi.fn(async () => 'job-ws'),
}))
vi.mock('@/src/lib/admin-audit', () => ({ recordAdminAction: vi.fn() }))
vi.mock('@/src/lib/storage/offsite-backup', () => ({
  getOffsiteConfig: vi.fn(() => null),
}))
vi.mock('@/src/lib/backup-download-token', () => ({
  createBackupDownloadToken: vi.fn(() => ({ exp: 1_900_000_000, sig: 'f00' })),
  verifyBackupDownloadToken: vi.fn(() => true),
}))

import { logger } from '@/lib/axiom/logger'
import { recordAdminAction } from '@/src/lib/admin-audit'
import { verifyBackupDownloadToken } from '@/src/lib/backup-download-token'
import {
  enqueueAdminOperation,
  triggerFullBackup,
  triggerWorkspaceBackup,
} from '@/src/lib/queue/database-backup'
import { getOffsiteConfig } from '@/src/lib/storage/offsite-backup'
import { AdminOperationRepository } from '@/src/repositories/admin-operation.repository'
import { BackupRepository } from '@/src/repositories/backup.repository'
import { UserRepository } from '@/src/repositories/user.repository'
import { WorkspaceRepository } from '@/src/repositories/workspace.repository'
import { AdminBackupService as Service } from '../admin-backup.service'

const userRepo = vi.mocked(UserRepository)
const workspaceRepo = vi.mocked(WorkspaceRepository)
const backupRepo = vi.mocked(BackupRepository)
const operationRepo = vi.mocked(AdminOperationRepository)

const admin = createFakeUser({
  isPlatformAdmin: true,
  email: 'admin@stratustelecom.com.br',
})

function backup(overrides: Partial<Backup> = {}): Backup {
  const now = new Date()
  return {
    id: 'b1',
    scope: 'WORKSPACE',
    workspaceId: 'ws1',
    workspaceSlug: 'acme',
    triggeredById: null,
    status: 'COMPLETED',
    storageKey: 'workspace/ws1/b1.json.enc',
    sizeBytes: 2048,
    checksum: 'sha',
    errorMessage: null,
    offsiteKey: null,
    offsiteCopiedAt: null,
    filesKey: 'workspace/ws1/b1.files/manifest.json.enc',
    fileCount: 2,
    fileBytes: BigInt(1024),
    startedAt: now,
    completedAt: now,
    expiresAt: now,
    ...overrides,
  }
}

beforeEach(() => {
  userRepo.findById.mockResolvedValue(ok(admin))
})

describe('AdminBackupService.list()', () => {
  it('flags deleted workspaces and backup locations', async () => {
    backupRepo.list.mockResolvedValue(
      ok([
        backup(),
        backup({ id: 'b2', workspaceId: 'gone', offsiteKey: null }),
        backup({
          id: 'b3',
          scope: 'FULL',
          workspaceId: null,
          offsiteKey: 'steel/full/b3.dump.enc',
        }),
      ]),
    )
    backupRepo.existingWorkspaceIds.mockResolvedValue(ok(new Set(['ws1'])))

    const dto = expectOk(await Service.list(admin.id, { limit: 50 }))

    expect(dto.offsiteConfigured).toBe(false)
    expect(dto.backups.map((b) => b.workspaceExists)).toEqual([
      true,
      false,
      false,
    ])
    expect(dto.backups[2].locations).toEqual({ local: true, offsite: true })
  })
})

describe('AdminBackupService.trigger()', () => {
  it('enqueues a full backup attributed to the admin', async () => {
    expect(
      expectOk(await Service.trigger(admin.id, { scope: 'FULL' })),
    ).toEqual({ jobId: 'job-full' })
    expect(triggerFullBackup).toHaveBeenCalledWith(admin.id)
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'backup.full_requested' }),
    )
  })

  it('enqueues a workspace backup, refusing one being deleted', async () => {
    workspaceRepo.findById.mockResolvedValue(
      ok(createFakeWorkspace({ id: 'ws1' })),
    )
    expectOk(
      await Service.trigger(admin.id, {
        scope: 'WORKSPACE',
        workspaceId: 'ws1',
      }),
    )
    expect(triggerWorkspaceBackup).toHaveBeenCalledWith('ws1', admin.id)

    workspaceRepo.findById.mockResolvedValue(
      ok(createFakeWorkspace({ id: 'ws1', status: 'DELETING' })),
    )
    expectErr(
      await Service.trigger(admin.id, {
        scope: 'WORKSPACE',
        workspaceId: 'ws1',
      }),
      'WORKSPACE_STATUS_CONFLICT',
    )
  })
})

describe('AdminBackupService download', () => {
  it('issues a signed short-lived link for a completed backup', async () => {
    backupRepo.findById.mockResolvedValue(ok(backup()))

    const link = expectOk(await Service.createDownloadLink(admin.id, 'b1'))

    expect(link.url).toBe(
      '/api/admin/backups/b1/download?exp=1900000000&sig=f00',
    )
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'backup.download_link' }),
    )
  })

  it('refuses a link for a failed backup', async () => {
    backupRepo.findById.mockResolvedValue(
      ok(backup({ status: 'FAILED', storageKey: null })),
    )
    expectErr(
      await Service.createDownloadLink(admin.id, 'b1'),
      'BACKUP_NOT_RESTORABLE',
    )
  })

  it('rejects an invalid signature before touching storage', async () => {
    vi.mocked(verifyBackupDownloadToken).mockReturnValueOnce(false)
    expectErr(
      await Service.authorizeDownload(admin.id, 'b1', { exp: 1, sig: 'x' }),
      'BACKUP_DOWNLOAD_LINK_INVALID',
    )
    expect(backupRepo.findById).not.toHaveBeenCalled()
  })

  it('returns the object to stream for a valid link', async () => {
    backupRepo.findById.mockResolvedValue(ok(backup()))
    const target = expectOk(
      await Service.authorizeDownload(admin.id, 'b1', { exp: 1, sig: 'x' }),
    )
    expect(target).toEqual({
      bucket: 'database-backups',
      key: 'workspace/ws1/b1.json.enc',
      filename: 'steel-workspace-b1.json.enc',
    })
  })
})

describe('AdminBackupService.requestRestore()', () => {
  const input = { confirmSlug: 'acme', reason: 'dados apagados por engano' }

  beforeEach(() => {
    backupRepo.findById.mockResolvedValue(ok(backup()))
    workspaceRepo.findWithMemberCount.mockResolvedValue(
      ok({
        ...createFakeWorkspace({ id: 'ws1', slug: 'acme' }),
        memberCount: 2,
      }),
    )
    operationRepo.findActiveByWorkspace.mockResolvedValue(ok(null))
    operationRepo.create.mockImplementation(async (data) =>
      ok({
        id: 'op9',
        status: 'QUEUED',
        step: 'queued',
        error: null,
        meta: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
        backupId: null,
        ...data,
      } as never),
    )
  })

  it('refuses FULL backups (runbook only)', async () => {
    backupRepo.findById.mockResolvedValue(
      ok(backup({ scope: 'FULL', workspaceId: null })),
    )
    expectErr(
      await Service.requestRestore(admin.id, 'b1', input),
      'BACKUP_NOT_RESTORABLE',
    )
  })

  it('requires the workspace slug', async () => {
    expectErr(
      await Service.requestRestore(admin.id, 'b1', {
        ...input,
        confirmSlug: 'outro',
      }),
      'WORKSPACE_CONFIRMATION_MISMATCH',
    )
  })

  it('enqueues the restore job and audits', async () => {
    const dto = expectOk(await Service.requestRestore(admin.id, 'b1', input))
    expect(dto).toMatchObject({ id: 'op9', kind: 'WORKSPACE_RESTORE' })
    expect(enqueueAdminOperation).toHaveBeenCalledWith('restore', 'op9')
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'workspace.restore_requested' }),
    )
  })

  it('restores a deleted workspace using the slug saved on the backup', async () => {
    workspaceRepo.findWithMemberCount.mockResolvedValue(ok(null))
    workspaceRepo.findBySlug.mockResolvedValue(ok(null))
    expectOk(await Service.requestRestore(admin.id, 'b1', input))
  })

  it('refuses when the slug was taken by another workspace since the deletion', async () => {
    workspaceRepo.findWithMemberCount.mockResolvedValue(ok(null))
    workspaceRepo.findBySlug.mockResolvedValue(
      ok(createFakeWorkspace({ id: 'other', slug: 'acme' })),
    )
    expectErr(await Service.requestRestore(admin.id, 'b1', input), 'CONFLICT')
    expect(enqueueAdminOperation).not.toHaveBeenCalled()
  })
})

describe('AdminBackupService failure paths', () => {
  const DB_ERROR = { code: 'DATABASE_ERROR' as const, message: 'db down' }
  const regular = createFakeUser({ isPlatformAdmin: false })

  it('denies every operation to a non platform admin', async () => {
    userRepo.findById.mockResolvedValue(ok(regular))

    expectErr(await Service.list(regular.id, { limit: 50 }), 'FORBIDDEN')
    expectErr(await Service.trigger(regular.id, { scope: 'FULL' }), 'FORBIDDEN')
    expectErr(await Service.createDownloadLink(regular.id, 'b1'), 'FORBIDDEN')
    expectErr(
      await Service.authorizeDownload(regular.id, 'b1', { exp: 1, sig: 'x' }),
      'FORBIDDEN',
    )
    expectErr(
      await Service.requestRestore(regular.id, 'b1', {
        confirmSlug: 'acme',
        reason: 'motivo qualquer',
      }),
      'FORBIDDEN',
    )
    expect(backupRepo.findById).not.toHaveBeenCalled()
  })

  it('list() propagates backup and workspace lookup failures', async () => {
    backupRepo.list.mockResolvedValue(err(DB_ERROR))
    expectErr(await Service.list(admin.id, { limit: 50 }), 'DATABASE_ERROR')

    backupRepo.list.mockResolvedValue(ok([backup()]))
    backupRepo.existingWorkspaceIds.mockResolvedValue(err(DB_ERROR))
    expectErr(await Service.list(admin.id, { limit: 50 }), 'DATABASE_ERROR')
  })

  it('list() reports an off-site copy when configured', async () => {
    vi.mocked(getOffsiteConfig).mockReturnValueOnce({} as never)
    backupRepo.list.mockResolvedValue(ok([]))
    backupRepo.existingWorkspaceIds.mockResolvedValue(ok(new Set()))

    expect(
      expectOk(await Service.list(admin.id, { limit: 50 })).offsiteConfigured,
    ).toBe(true)
  })

  it('trigger() propagates a workspace lookup failure', async () => {
    workspaceRepo.findById.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await Service.trigger(admin.id, {
        scope: 'WORKSPACE',
        workspaceId: 'ws1',
      }),
      'DATABASE_ERROR',
    )
    expect(triggerWorkspaceBackup).not.toHaveBeenCalled()
  })

  it.each([
    [new Error('redis down'), 'redis down'],
    ['boom', 'boom'],
  ])('trigger() maps a queue failure (%s) to INTERNAL_SERVER_ERROR', async (thrown, logged) => {
    vi.mocked(triggerFullBackup).mockRejectedValueOnce(thrown)

    const error = expectErr(
      await Service.trigger(admin.id, { scope: 'FULL' }),
      'INTERNAL_SERVER_ERROR',
    )
    expect(error.message).toBe(
      'Fila de backups indisponível. Tente novamente em instantes.',
    )
    expect(logger.error).toHaveBeenCalledWith(
      'admin.backup.trigger_failed',
      expect.objectContaining({ scope: 'FULL', message: logged }),
    )
    expect(recordAdminAction).not.toHaveBeenCalled()
  })

  it('createDownloadLink() propagates lookup failures and unknown backups', async () => {
    backupRepo.findById.mockResolvedValue(err(DB_ERROR))
    expectErr(
      await Service.createDownloadLink(admin.id, 'b1'),
      'DATABASE_ERROR',
    )

    backupRepo.findById.mockResolvedValue(ok(null))
    expectErr(
      await Service.createDownloadLink(admin.id, 'b1'),
      'BACKUP_NOT_FOUND',
    )
  })

  it('labels FULL backups by scope in the audit trail', async () => {
    const full = backup({
      scope: 'FULL',
      workspaceId: null,
      workspaceSlug: null,
      storageKey: 'full/b1.dump.enc',
    })
    backupRepo.findById.mockResolvedValue(ok(full))

    expectOk(await Service.createDownloadLink(admin.id, 'b1'))
    const target = expectOk(
      await Service.authorizeDownload(admin.id, 'b1', { exp: 1, sig: 'x' }),
    )

    expect(target.filename).toBe('steel-full-b1.dump.enc')
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'backup.download_link',
        targetLabel: 'FULL',
      }),
    )
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'backup.download',
        targetLabel: 'FULL',
      }),
    )
  })

  it('authorizeDownload() propagates a lookup failure and hides unfinished backups', async () => {
    backupRepo.findById.mockResolvedValue(err(DB_ERROR))
    expectErr(
      await Service.authorizeDownload(admin.id, 'b1', { exp: 1, sig: 'x' }),
      'DATABASE_ERROR',
    )

    backupRepo.findById.mockResolvedValue(
      ok(
        backup({ status: 'RUNNING', storageKey: 'workspace/ws1/b1.json.enc' }),
      ),
    )
    expectErr(
      await Service.authorizeDownload(admin.id, 'b1', { exp: 1, sig: 'x' }),
      'BACKUP_NOT_FOUND',
    )

    backupRepo.findById.mockResolvedValue(ok(null))
    expectErr(
      await Service.authorizeDownload(admin.id, 'b1', { exp: 1, sig: 'x' }),
      'BACKUP_NOT_FOUND',
    )
  })

  describe('requestRestore()', () => {
    const input = { confirmSlug: 'acme', reason: 'dados apagados por engano' }
    const restore = () => Service.requestRestore(admin.id, 'b1', input)

    beforeEach(() => {
      backupRepo.findById.mockResolvedValue(ok(backup()))
      workspaceRepo.findWithMemberCount.mockResolvedValue(
        ok({
          ...createFakeWorkspace({ id: 'ws1', slug: 'acme', name: 'Acme' }),
          memberCount: 2,
        }),
      )
      operationRepo.findActiveByWorkspace.mockResolvedValue(ok(null))
      operationRepo.create.mockImplementation(async (data) =>
        ok({ id: 'op9', status: 'QUEUED', ...data } as never),
      )
      operationRepo.markFailed.mockResolvedValue(ok(undefined) as never)
    })

    it('propagates a backup lookup failure and unknown backups', async () => {
      backupRepo.findById.mockResolvedValue(err(DB_ERROR))
      expectErr(await restore(), 'DATABASE_ERROR')

      backupRepo.findById.mockResolvedValue(ok(null))
      expectErr(await restore(), 'BACKUP_NOT_FOUND')
    })

    it('refuses a backup that did not complete', async () => {
      backupRepo.findById.mockResolvedValue(
        ok(backup({ status: 'FAILED', storageKey: null })),
      )

      const error = expectErr(await restore(), 'BACKUP_NOT_RESTORABLE')
      expect(error.message).toBe('O backup não foi concluído')
    })

    it('propagates a workspace lookup failure', async () => {
      workspaceRepo.findWithMemberCount.mockResolvedValue(err(DB_ERROR))

      expectErr(await restore(), 'DATABASE_ERROR')
    })

    it('fails when neither the workspace nor the backup knows the slug', async () => {
      workspaceRepo.findWithMemberCount.mockResolvedValue(ok(null))
      backupRepo.findById.mockResolvedValue(ok(backup({ workspaceSlug: null })))

      expectErr(await restore(), 'RESOURCE_NOT_FOUND')
    })

    it('propagates a failure checking running operations', async () => {
      operationRepo.findActiveByWorkspace.mockResolvedValue(err(DB_ERROR))

      expectErr(await restore(), 'DATABASE_ERROR')
    })

    it('refuses while another operation is running', async () => {
      operationRepo.findActiveByWorkspace.mockResolvedValue(
        ok({ id: 'op1' } as never),
      )

      expectErr(await restore(), 'WORKSPACE_OPERATION_IN_PROGRESS')
      expect(operationRepo.create).not.toHaveBeenCalled()
    })

    it('refuses while the workspace is being deleted', async () => {
      workspaceRepo.findWithMemberCount.mockResolvedValue(
        ok({
          ...createFakeWorkspace({
            id: 'ws1',
            slug: 'acme',
            status: 'DELETING',
          }),
          memberCount: 2,
        }),
      )

      expectErr(await restore(), 'WORKSPACE_OPERATION_IN_PROGRESS')
    })

    it('propagates a failure checking whether the slug was reused', async () => {
      workspaceRepo.findWithMemberCount.mockResolvedValue(ok(null))
      workspaceRepo.findBySlug.mockResolvedValue(err(DB_ERROR))

      expectErr(await restore(), 'DATABASE_ERROR')
    })

    it('propagates a failure creating the operation', async () => {
      operationRepo.create.mockResolvedValue(err(DB_ERROR))

      expectErr(await restore(), 'DATABASE_ERROR')
      expect(enqueueAdminOperation).not.toHaveBeenCalled()
    })

    it.each([
      [new Error('redis down'), 'redis down'],
      ['boom', 'boom'],
    ])('marks the operation failed when enqueueing throws %s', async (thrown, message) => {
      vi.mocked(enqueueAdminOperation).mockRejectedValueOnce(thrown)

      expectErr(await restore(), 'INTERNAL_SERVER_ERROR')
      expect(operationRepo.markFailed).toHaveBeenCalledWith('op9', message)
      expect(recordAdminAction).not.toHaveBeenCalled()
    })
  })
})
