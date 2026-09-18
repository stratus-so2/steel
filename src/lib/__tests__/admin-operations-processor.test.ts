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
  recordAdminAction: vi.fn(),
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
})

describe('runWorkspaceDeletion()', () => {
  it('backs up first, then purges rows and files, and records the audit', async () => {
    mocks.op.findUnique.mockResolvedValue(operation())
    mocks.backupWorkspace.mockResolvedValue({ backupId: 'b1', sizeBytes: 10 })

    const result = await runWorkspaceDeletion(job('delete-workspace'))

    expect(result).toEqual({ backupId: 'b1', filesDeleted: 3 })
    expect(mocks.backupWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws1', triggeredById: 'admin1' }),
    )
    // Ordem: backup concluído antes do purge.
    expect(mocks.backupWorkspace.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.purgeWorkspaceRows.mock.invocationCallOrder[0],
    )
    expect(mocks.purgeWorkspaceRows).toHaveBeenCalledWith({}, 'ws1')
    expect(mocks.purgeWorkspaceFiles).toHaveBeenCalledWith('ws1', ['c1/a.pdf'])
    expect(mocks.op.update).toHaveBeenLastCalledWith({
      where: { id: 'op1' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        step: 'done',
        meta: expect.objectContaining({
          filesDeleted: 3,
          subscriptionsToCancel: [
            expect.objectContaining({ billId: 'bill_1' }),
          ],
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
    mocks.backupWorkspace.mockResolvedValue({ backupId: 'b1', sizeBytes: 10 })
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
      backup: { id: 'b1', scope: 'WORKSPACE', workspaceId: 'ws1' },
    })
    mocks.restoreWorkspaceSnapshot.mockResolvedValue({ tables: 4, rows: 12 })
  })

  it('takes a safety backup of the current state before restoring', async () => {
    mocks.op.findUnique.mockResolvedValue(
      operation({ kind: 'WORKSPACE_RESTORE', backupId: 'b1', meta: null }),
    )
    mocks.workspace.findUnique.mockResolvedValue({ id: 'ws1' })
    mocks.backupWorkspace.mockResolvedValue({ backupId: 'safe1', sizeBytes: 1 })

    const result = await runWorkspaceRestore(job('restore-workspace'))

    expect(result).toEqual({ tables: 4, rows: 12 })
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
