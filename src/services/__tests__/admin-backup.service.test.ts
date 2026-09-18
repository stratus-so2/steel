import type { Backup } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeUser } from '@/src/__tests__/factories/user.factory'
import { createFakeWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

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

import { recordAdminAction } from '@/src/lib/admin-audit'
import { verifyBackupDownloadToken } from '@/src/lib/backup-download-token'
import {
  enqueueAdminOperation,
  triggerFullBackup,
  triggerWorkspaceBackup,
} from '@/src/lib/queue/database-backup'
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
