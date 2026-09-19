import type { Job } from 'bullmq'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  op: { findUnique: vi.fn(), update: vi.fn() },
  backup: { findUnique: vi.fn() },
  workspace: { findUnique: vi.fn(), updateMany: vi.fn() },
  aiAttachment: { findMany: vi.fn() },
  subscription: { findMany: vi.fn() },
  transaction: vi.fn(),
  backupWorkspace: vi.fn(),
  purgeWorkspaceRows: vi.fn(),
  restoreWorkspaceSnapshot: vi.fn(),
  purgeWorkspaceFiles: vi.fn(),
  fetchAndDecryptBackup: vi.fn(),
  readWorkspaceFilesManifest: vi.fn(),
  restoreWorkspaceFiles: vi.fn(),
  recordAdminAction: vi.fn(),
  cancelWorkspaceSubscriptions: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/src/lib/prisma', () => ({
  prisma: {
    adminOperation: mocks.op,
    backup: mocks.backup,
    workspace: mocks.workspace,
    crmAiAttachment: mocks.aiAttachment,
    subscription: mocks.subscription,
    $transaction: mocks.transaction,
  },
}))
vi.mock('@/src/lib/queue/processors/database-backup', () => ({
  backupWorkspace: mocks.backupWorkspace,
}))
vi.mock('@/src/lib/queue/workspace-snapshot', () => ({
  purgeWorkspaceRows: mocks.purgeWorkspaceRows,
  restoreWorkspaceSnapshot: mocks.restoreWorkspaceSnapshot,
}))
vi.mock('@/src/lib/storage/workspace-files', () => ({
  purgeWorkspaceFiles: mocks.purgeWorkspaceFiles,
}))
vi.mock('@/src/lib/queue/database-restore', () => ({
  fetchAndDecryptBackup: mocks.fetchAndDecryptBackup,
}))
vi.mock('@/src/lib/queue/workspace-file-archive', () => ({
  readWorkspaceFilesManifest: mocks.readWorkspaceFilesManifest,
  restoreWorkspaceFiles: mocks.restoreWorkspaceFiles,
}))
vi.mock('@/src/lib/admin-audit', () => ({
  recordAdminAction: mocks.recordAdminAction,
}))
vi.mock('@/src/cache/workspace.cache', () => ({
  WorkspaceCache: { invalidate: vi.fn().mockResolvedValue(undefined) },
}))
vi.mock('@/src/cache/workspace-features.cache', () => ({
  WorkspaceFeaturesCache: { invalidate: vi.fn().mockResolvedValue(undefined) },
}))
vi.mock('@/lib/axiom/logger', () => ({ logger: mocks.logger }))
vi.mock('@/src/services/subscription.service', () => ({
  SubscriptionService: {
    cancelWorkspaceSubscriptions: mocks.cancelWorkspaceSubscriptions,
  },
}))

import { WorkspaceCache } from '@/src/cache/workspace.cache'
import {
  runWorkspaceDeletion,
  runWorkspaceRestore,
} from '@/src/lib/queue/processors/admin-operations'

function operation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'op1',
    kind: 'WORKSPACE_DELETE',
    status: 'QUEUED',
    step: 'queued',
    workspaceId: 'ws1',
    workspaceSlug: 'acme',
    workspaceName: 'Acme',
    backupId: null,
    requestedById: 'admin1',
    requestedByEmail: 'admin@stratustelecom.com.br',
    reason: 'cliente encerrou o contrato',
    error: null,
    meta: { previousStatus: 'ACTIVE' },
    ...overrides,
  }
}

function cancelAttempt(overrides: Record<string, unknown> = {}) {
  return {
    billId: 'bill_1',
    plan: 'PRO',
    status: 'PAID',
    interval: 'MONTHLY',
    outcome: 'CANCELLED',
    error: null,
    ...overrides,
  }
}

const job = (name: string) =>
  ({ id: 'job1', name, data: { operationId: 'op1' } }) as unknown as Job<{
    operationId: string
  }>

beforeEach(() => {
  vi.clearAllMocks()
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({}),
  )
  mocks.aiAttachment.findMany.mockResolvedValue([{ storageKey: 'c1/a.pdf' }])
  mocks.subscription.findMany.mockResolvedValue([
    { billId: 'bill_1', plan: 'PRO', status: 'PAID', interval: 'MONTHLY' },
  ])
  mocks.purgeWorkspaceFiles.mockResolvedValue({ deleted: 3, byBucket: {} })
  mocks.cancelWorkspaceSubscriptions.mockResolvedValue({
    ok: true,
    value: {
      attempts: [cancelAttempt()],
      cancelled: [cancelAttempt()],
      failed: [],
    },
  })
  mocks.readWorkspaceFilesManifest.mockResolvedValue({
    version: 1,
    workspaceId: 'ws1',
    backupId: 'b1',
    files: [],
    missingLegacyKeys: 0,
  })
  mocks.restoreWorkspaceFiles.mockResolvedValue({
    restored: 2,
    planned: 2,
    bytes: 2048,
    byBucket: {},
    dryRun: false,
  })
})

describe('runWorkspaceDeletion()', () => {
  it('backs up first, then purges rows and files, and records the audit', async () => {
    mocks.op.findUnique.mockResolvedValue(operation())
    mocks.backupWorkspace.mockResolvedValue({
      backupId: 'b1',
      sizeBytes: 10,
      fileCount: 0,
      fileBytes: 0,
    })

    const result = await runWorkspaceDeletion(job('delete-workspace'))

    expect(result).toEqual({ backupId: 'b1', filesDeleted: 3 })
    expect(mocks.backupWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws1', triggeredById: 'admin1' }),
    )
    // Ordem: backup → cancelamento das assinaturas → purge.
    expect(mocks.backupWorkspace.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.cancelWorkspaceSubscriptions.mock.invocationCallOrder[0],
    )
    expect(
      mocks.cancelWorkspaceSubscriptions.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.purgeWorkspaceRows.mock.invocationCallOrder[0])
    expect(mocks.cancelWorkspaceSubscriptions).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      actorId: 'admin1',
      source: 'admin_workspace_deletion',
    })
    expect(mocks.purgeWorkspaceRows).toHaveBeenCalledWith({}, 'ws1')
    expect(mocks.purgeWorkspaceFiles).toHaveBeenCalledWith('ws1', ['c1/a.pdf'])
    expect(mocks.op.update).toHaveBeenLastCalledWith({
      where: { id: 'op1' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        step: 'done',
        meta: expect.objectContaining({
          filesDeleted: 3,
          subscriptionsCancelled: [{ billId: 'bill_1', plan: 'PRO' }],
          subscriptionsToCancel: [],
        }),
      }),
    })
    expect(mocks.recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'workspace.deleted',
        targetId: 'ws1',
        targetLabel: 'acme',
      }),
    )
  })

  it('never purges when the backup fails, and restores the previous status', async () => {
    mocks.op.findUnique.mockResolvedValue(
      operation({ meta: { previousStatus: 'SUSPENDED' } }),
    )
    mocks.backupWorkspace.mockRejectedValue(new Error('minio down'))

    await expect(runWorkspaceDeletion(job('delete-workspace'))).rejects.toThrow(
      'minio down',
    )

    expect(mocks.purgeWorkspaceRows).not.toHaveBeenCalled()
    expect(mocks.purgeWorkspaceFiles).not.toHaveBeenCalled()
    expect(mocks.workspace.updateMany).toHaveBeenCalledWith({
      where: { id: 'ws1', status: 'DELETING' },
      data: { status: 'SUSPENDED' },
    })
    expect(mocks.op.update).toHaveBeenLastCalledWith({
      where: { id: 'op1' },
      data: expect.objectContaining({ status: 'FAILED', error: 'minio down' }),
    })
    expect(mocks.recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'workspace.delete_failed',
        outcome: 'failure',
      }),
    )
  })

  it('completes with a recorded filesError when only the file purge fails', async () => {
    mocks.op.findUnique.mockResolvedValue(operation())
    mocks.backupWorkspace.mockResolvedValue({
      backupId: 'b1',
      sizeBytes: 10,
      fileCount: 0,
      fileBytes: 0,
    })
    mocks.purgeWorkspaceFiles.mockRejectedValue(new Error('bucket locked'))

    await runWorkspaceDeletion(job('delete-workspace'))

    expect(mocks.op.update).toHaveBeenLastCalledWith({
      where: { id: 'op1' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        meta: expect.objectContaining({ filesError: 'bucket locked' }),
      }),
    })
    expect(mocks.workspace.updateMany).not.toHaveBeenCalled()
  })

  it('reuses a completed backup already attached to the operation', async () => {
    mocks.op.findUnique.mockResolvedValue(operation({ backupId: 'b0' }))
    mocks.backup.findUnique.mockResolvedValue({ id: 'b0', status: 'COMPLETED' })

    await runWorkspaceDeletion(job('delete-workspace'))

    expect(mocks.backupWorkspace).not.toHaveBeenCalled()
    expect(mocks.purgeWorkspaceRows).toHaveBeenCalled()
  })

  it('blocks the deletion when a subscription fails to cancel at the provider', async () => {
    mocks.op.findUnique.mockResolvedValue(operation())
    mocks.backupWorkspace.mockResolvedValue({ backupId: 'b1', sizeBytes: 10 })
    const failed = cancelAttempt({ outcome: 'FAILED', error: 'gateway down' })
    mocks.cancelWorkspaceSubscriptions.mockResolvedValue({
      ok: true,
      value: { attempts: [failed], cancelled: [], failed: [failed] },
    })

    await expect(runWorkspaceDeletion(job('delete-workspace'))).rejects.toThrow(
      /Exclusão barrada/,
    )

    expect(mocks.purgeWorkspaceRows).not.toHaveBeenCalled()
    expect(mocks.purgeWorkspaceFiles).not.toHaveBeenCalled()
    expect(mocks.workspace.updateMany).toHaveBeenCalledWith({
      where: { id: 'ws1', status: 'DELETING' },
      data: { status: 'ACTIVE' },
    })
    expect(mocks.recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'workspace.delete_failed',
        outcome: 'failure',
      }),
    )
  })

  it('proceeds and flags the manual cancellation when the admin forces it', async () => {
    mocks.op.findUnique.mockResolvedValue(
      operation({
        meta: {
          previousStatus: 'ACTIVE',
          ignoreSubscriptionCancelFailure: true,
        },
      }),
    )
    mocks.backupWorkspace.mockResolvedValue({ backupId: 'b1', sizeBytes: 10 })
    const failed = cancelAttempt({ outcome: 'FAILED', error: 'gateway down' })
    mocks.cancelWorkspaceSubscriptions.mockResolvedValue({
      ok: true,
      value: { attempts: [failed], cancelled: [], failed: [failed] },
    })

    await runWorkspaceDeletion(job('delete-workspace'))

    expect(mocks.purgeWorkspaceRows).toHaveBeenCalled()
    expect(mocks.op.update).toHaveBeenLastCalledWith({
      where: { id: 'op1' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        meta: expect.objectContaining({
          subscriptionsCancelled: [],
          subscriptionsToCancel: [{ billId: 'bill_1', plan: 'PRO' }],
        }),
      }),
    })
    expect(mocks.recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'workspace.deleted',
        meta: expect.objectContaining({
          subscriptionCancelForced: true,
          subscriptionsToCancel: ['bill_1'],
        }),
      }),
    )
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'queue.admin_operation.subscription_cancel_forced',
      expect.objectContaining({ billIds: ['bill_1'] }),
    )
  })

  it('never purges when the subscription lookup itself fails', async () => {
    mocks.op.findUnique.mockResolvedValue(operation())
    mocks.backupWorkspace.mockResolvedValue({ backupId: 'b1', sizeBytes: 10 })
    mocks.cancelWorkspaceSubscriptions.mockResolvedValue({
      ok: false,
      error: { code: 'DATABASE_ERROR', message: 'db down' },
    })

    await expect(runWorkspaceDeletion(job('delete-workspace'))).rejects.toThrow(
      /db down/,
    )
    expect(mocks.purgeWorkspaceRows).not.toHaveBeenCalled()
  })

  it('skips an operation that already failed or completed', async () => {
    mocks.op.findUnique.mockResolvedValue(operation({ status: 'FAILED' }))
    expect(await runWorkspaceDeletion(job('delete-workspace'))).toBeUndefined()
    mocks.op.findUnique.mockResolvedValue(operation({ status: 'COMPLETED' }))
    expect(await runWorkspaceDeletion(job('delete-workspace'))).toBeUndefined()
    expect(mocks.backupWorkspace).not.toHaveBeenCalled()
  })
})

describe('runWorkspaceRestore()', () => {
  const snapshot = { workspaceId: 'ws1', data: { workspace: { id: 'ws1' } } }

  beforeEach(() => {
    mocks.fetchAndDecryptBackup.mockResolvedValue({
      buffer: Buffer.from(JSON.stringify(snapshot)),
      backup: {
        id: 'b1',
        scope: 'WORKSPACE',
        workspaceId: 'ws1',
        filesKey: 'workspace/ws1/b1.files/manifest.json.enc',
      },
    })
    mocks.restoreWorkspaceSnapshot.mockResolvedValue({ tables: 4, rows: 12 })
  })

  it('takes a safety backup of the current state before restoring', async () => {
    mocks.op.findUnique.mockResolvedValue(
      operation({ kind: 'WORKSPACE_RESTORE', backupId: 'b1', meta: null }),
    )
    mocks.workspace.findUnique.mockResolvedValue({ id: 'ws1' })
    mocks.backupWorkspace.mockResolvedValue({
      backupId: 'safe1',
      sizeBytes: 1,
      fileCount: 0,
      fileBytes: 0,
    })

    const result = await runWorkspaceRestore(job('restore-workspace'))

    expect(result).toEqual({ tables: 4, rows: 12, filesRestored: 2 })
    expect(mocks.backupWorkspace.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.restoreWorkspaceSnapshot.mock.invocationCallOrder[0],
    )
    expect(mocks.op.update).toHaveBeenLastCalledWith({
      where: { id: 'op1' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        meta: expect.objectContaining({ safetyBackupId: 'safe1' }),
      }),
    })
  })

  it('skips the file step for a backup taken before files were included', async () => {
    mocks.op.findUnique.mockResolvedValue(
      operation({ kind: 'WORKSPACE_RESTORE', backupId: 'b1' }),
    )
    mocks.workspace.findUnique.mockResolvedValue(null)
    mocks.fetchAndDecryptBackup.mockResolvedValue({
      buffer: Buffer.from(JSON.stringify(snapshot)),
      backup: {
        id: 'b1',
        scope: 'WORKSPACE',
        workspaceId: 'ws1',
        filesKey: null,
      },
    })

    const result = await runWorkspaceRestore(job('restore-workspace'))

    expect(result).toEqual({ tables: 4, rows: 12, filesRestored: 0 })
    expect(mocks.readWorkspaceFilesManifest).not.toHaveBeenCalled()
    expect(mocks.op.update).toHaveBeenLastCalledWith({
      where: { id: 'op1' },
      data: expect.objectContaining({
        meta: expect.objectContaining({ filesRestored: 0, filesError: null }),
      }),
    })
  })

  it('completes with filesError when the file step fails (rows are already back)', async () => {
    mocks.op.findUnique.mockResolvedValue(
      operation({ kind: 'WORKSPACE_RESTORE', backupId: 'b1' }),
    )
    mocks.workspace.findUnique.mockResolvedValue(null)
    mocks.restoreWorkspaceFiles.mockRejectedValue(new Error('minio down'))

    const result = await runWorkspaceRestore(job('restore-workspace'))

    expect(result).toEqual({ tables: 4, rows: 12, filesRestored: 0 })
    expect(mocks.op.update).toHaveBeenLastCalledWith({
      where: { id: 'op1' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        meta: expect.objectContaining({ filesError: 'minio down' }),
      }),
    })
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'queue.admin_operation.workspace_files_restore_failed',
      expect.objectContaining({ message: 'minio down' }),
    )
  })

  it('stringifies a non-Error failure in the file step', async () => {
    mocks.op.findUnique.mockResolvedValue(
      operation({ kind: 'WORKSPACE_RESTORE', backupId: 'b1' }),
    )
    mocks.workspace.findUnique.mockResolvedValue(null)
    mocks.readWorkspaceFilesManifest.mockRejectedValue('manifest gone')

    await runWorkspaceRestore(job('restore-workspace'))

    expect(mocks.op.update).toHaveBeenLastCalledWith({
      where: { id: 'op1' },
      data: expect.objectContaining({
        meta: expect.objectContaining({ filesError: 'manifest gone' }),
      }),
    })
  })

  it('restores a deleted workspace without a safety backup', async () => {
    mocks.op.findUnique.mockResolvedValue(
      operation({ kind: 'WORKSPACE_RESTORE', backupId: 'b1' }),
    )
    mocks.workspace.findUnique.mockResolvedValue(null)

    await runWorkspaceRestore(job('restore-workspace'))

    expect(mocks.backupWorkspace).not.toHaveBeenCalled()
    expect(mocks.restoreWorkspaceSnapshot).toHaveBeenCalled()
  })

  it('fails when the backup belongs to another workspace', async () => {
    mocks.op.findUnique.mockResolvedValue(
      operation({
        kind: 'WORKSPACE_RESTORE',
        backupId: 'b1',
        workspaceId: 'ws2',
      }),
    )
    mocks.workspace.findUnique.mockResolvedValue(null)

    await expect(runWorkspaceRestore(job('restore-workspace'))).rejects.toThrow(
      /outro workspace/,
    )
    expect(mocks.restoreWorkspaceSnapshot).not.toHaveBeenCalled()
    expect(mocks.op.update).toHaveBeenLastCalledWith({
      where: { id: 'op1' },
      data: expect.objectContaining({ status: 'FAILED' }),
    })
  })
})

describe('admin operations — edge cases', () => {
  it('skips an operation that no longer exists', async () => {
    mocks.op.findUnique.mockResolvedValue(null)

    expect(await runWorkspaceRestore(job('restore-workspace'))).toBeUndefined()
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'queue.admin_operation.skipped',
      expect.objectContaining({ reason: 'not_found' }),
    )
  })

  it('reverts to ACTIVE (no meta) when the row purge transaction fails', async () => {
    mocks.op.findUnique.mockResolvedValue(operation({ meta: null }))
    mocks.backupWorkspace.mockResolvedValue({ backupId: 'b1', sizeBytes: 1 })
    mocks.transaction.mockRejectedValue('deadlock')

    await expect(runWorkspaceDeletion(job('delete-workspace'))).rejects.toBe(
      'deadlock',
    )
    expect(mocks.workspace.updateMany).toHaveBeenCalledWith({
      where: { id: 'ws1', status: 'DELETING' },
      data: { status: 'ACTIVE' },
    })
    expect(mocks.op.update).toHaveBeenLastCalledWith({
      where: { id: 'op1' },
      data: expect.objectContaining({ status: 'FAILED', error: 'deadlock' }),
    })
  })

  it('fails without purging when the backup step yields no id', async () => {
    mocks.op.findUnique.mockResolvedValue(operation({ backupId: 'b0' }))
    mocks.backup.findUnique.mockResolvedValue({ id: 'b0', status: 'FAILED' })
    mocks.backupWorkspace.mockResolvedValue({ backupId: '', sizeBytes: 0 })

    await expect(runWorkspaceDeletion(job('delete-workspace'))).rejects.toThrow(
      'Backup do workspace não foi gerado.',
    )
    expect(mocks.purgeWorkspaceRows).not.toHaveBeenCalled()
  })

  it('records non-Error file purge failures and tolerates cache invalidation errors', async () => {
    mocks.op.findUnique.mockResolvedValue(operation())
    mocks.backupWorkspace.mockResolvedValue({ backupId: 'b1', sizeBytes: 1 })
    mocks.purgeWorkspaceFiles.mockRejectedValue('timeout')
    vi.mocked(WorkspaceCache.invalidate).mockRejectedValueOnce(
      new Error('redis down'),
    )

    const result = await runWorkspaceDeletion(job('delete-workspace'))

    expect(result).toEqual({ backupId: 'b1', filesDeleted: 0 })
    expect(mocks.op.update).toHaveBeenLastCalledWith({
      where: { id: 'op1' },
      data: expect.objectContaining({
        meta: expect.objectContaining({ filesError: 'timeout' }),
      }),
    })
  })

  it('fails a restore without a source backup', async () => {
    mocks.op.findUnique.mockResolvedValue(
      operation({ kind: 'WORKSPACE_RESTORE', backupId: null }),
    )

    await expect(runWorkspaceRestore(job('restore-workspace'))).rejects.toThrow(
      'Operação sem backup de origem.',
    )
    expect(mocks.fetchAndDecryptBackup).not.toHaveBeenCalled()
    expect(mocks.recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'workspace.restore_failed' }),
    )
  })

  it('refuses to restore from a FULL backup', async () => {
    mocks.op.findUnique.mockResolvedValue(
      operation({ kind: 'WORKSPACE_RESTORE', backupId: 'b9' }),
    )
    mocks.workspace.findUnique.mockResolvedValue(null)
    mocks.fetchAndDecryptBackup.mockResolvedValue({
      buffer: Buffer.from('{}'),
      backup: { id: 'b9', scope: 'FULL', workspaceId: null },
    })

    await expect(runWorkspaceRestore(job('restore-workspace'))).rejects.toThrow(
      'Backup "b9" não é de workspace.',
    )
    expect(mocks.restoreWorkspaceSnapshot).not.toHaveBeenCalled()
  })

  it('stringifies non-Error restore failures', async () => {
    mocks.op.findUnique.mockResolvedValue(
      operation({ kind: 'WORKSPACE_RESTORE', backupId: 'b1' }),
    )
    mocks.workspace.findUnique.mockResolvedValue(null)
    mocks.fetchAndDecryptBackup.mockRejectedValue('decrypt failed')

    await expect(runWorkspaceRestore(job('restore-workspace'))).rejects.toBe(
      'decrypt failed',
    )
    expect(mocks.op.update).toHaveBeenLastCalledWith({
      where: { id: 'op1' },
      data: expect.objectContaining({ error: 'decrypt failed' }),
    })
  })
})

describe('admin operations — failure after the purge', () => {
  it('does not revert the workspace status once rows were already purged', async () => {
    mocks.op.findUnique.mockResolvedValue(operation())
    mocks.backupWorkspace.mockResolvedValue({ backupId: 'b1', sizeBytes: 1 })
    mocks.recordAdminAction.mockRejectedValueOnce(new Error('audit down'))

    await expect(runWorkspaceDeletion(job('delete-workspace'))).rejects.toThrow(
      'audit down',
    )
    expect(mocks.purgeWorkspaceRows).toHaveBeenCalled()
    expect(mocks.workspace.updateMany).not.toHaveBeenCalled()
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'queue.admin_operation.workspace_delete_failed',
      expect.objectContaining({ databasePurged: true }),
    )
  })
})
