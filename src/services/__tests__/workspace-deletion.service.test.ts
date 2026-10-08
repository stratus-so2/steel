import type { AdminOperation } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/workspace.repository')
vi.mock('@/src/repositories/admin-operation.repository')
vi.mock('@/src/lib/queue/database-backup', () => ({
  enqueueAdminOperation: vi.fn(),
}))
vi.mock('@/src/cache/workspace.cache', () => ({
  WorkspaceCache: { invalidate: vi.fn() },
}))
vi.mock('@/src/cache/workspace-features.cache', () => ({
  WorkspaceFeaturesCache: { invalidate: vi.fn() },
}))
vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { logger } from '@/lib/axiom/logger'
import { WorkspaceCache } from '@/src/cache/workspace.cache'
import { enqueueAdminOperation } from '@/src/lib/queue/database-backup'
import { AdminOperationRepository } from '@/src/repositories/admin-operation.repository'
import { WorkspaceRepository } from '@/src/repositories/workspace.repository'
import {
  invalidateWorkspaceCaches,
  queueWorkspaceDeletion,
} from '../workspace-deletion'

const workspaceRepo = vi.mocked(WorkspaceRepository)
const operationRepo = vi.mocked(AdminOperationRepository)
const enqueue = vi.mocked(enqueueAdminOperation)

const operation = {
  id: 'op1',
  kind: 'WORKSPACE_DELETE',
  status: 'QUEUED',
  createdAt: new Date('2026-10-08T12:00:00Z'),
} as AdminOperation

const input = {
  workspace: {
    id: 'ws1',
    slug: 'acme',
    name: 'Acme',
    status: 'ACTIVE' as const,
  },
  requester: { userId: 'owner', email: 'owner@acme.test' },
  reason: 'owner request',
  ignoreSubscriptionCancelFailure: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  operationRepo.findActiveByWorkspace.mockResolvedValue(ok(null))
  operationRepo.create.mockResolvedValue(ok(operation))
  operationRepo.markFailed.mockResolvedValue(ok(undefined) as never)
  workspaceRepo.setStatus.mockResolvedValue(ok({} as never))
  enqueue.mockResolvedValue()
  vi.mocked(WorkspaceCache.invalidate).mockResolvedValue()
})

describe('queueWorkspaceDeletion()', () => {
  it('records the operation, blocks the workspace and enqueues the job', async () => {
    const result = expectOk(await queueWorkspaceDeletion(input))

    expect(result.id).toBe('op1')
    expect(operationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'WORKSPACE_DELETE',
        workspaceId: 'ws1',
        workspaceSlug: 'acme',
        requestedById: 'owner',
        requestedByEmail: 'owner@acme.test',
        reason: 'owner request',
        meta: {
          previousStatus: 'ACTIVE',
          ignoreSubscriptionCancelFailure: false,
        },
      }),
    )
    expect(workspaceRepo.setStatus).toHaveBeenCalledWith('ws1', {
      status: 'DELETING',
    })
    expect(enqueue).toHaveBeenCalledWith('delete', 'op1')
    expect(WorkspaceCache.invalidate).toHaveBeenCalledWith('ws1')
  })

  it('refuses while another operation is running', async () => {
    operationRepo.findActiveByWorkspace.mockResolvedValue(ok(operation))
    expectErr(
      await queueWorkspaceDeletion(input),
      'WORKSPACE_OPERATION_IN_PROGRESS',
    )
    expect(operationRepo.create).not.toHaveBeenCalled()
  })

  it('refuses a workspace already being deleted', async () => {
    expectErr(
      await queueWorkspaceDeletion({
        ...input,
        workspace: { ...input.workspace, status: 'DELETING' },
      }),
      'WORKSPACE_OPERATION_IN_PROGRESS',
    )
  })

  it('propagates repository errors', async () => {
    operationRepo.findActiveByWorkspace.mockResolvedValueOnce(
      err(databaseError()),
    )
    expectErr(await queueWorkspaceDeletion(input), 'DATABASE_ERROR')

    operationRepo.create.mockResolvedValueOnce(err(databaseError()))
    expectErr(await queueWorkspaceDeletion(input), 'DATABASE_ERROR')
    expect(workspaceRepo.setStatus).not.toHaveBeenCalled()
  })

  it('fails the operation when the workspace cannot be marked', async () => {
    workspaceRepo.setStatus.mockResolvedValueOnce(err(databaseError()))

    expectErr(await queueWorkspaceDeletion(input), 'DATABASE_ERROR')
    expect(operationRepo.markFailed).toHaveBeenCalledWith(
      'op1',
      'Falha ao marcar o workspace para exclusão',
    )
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('rolls back the status when the job cannot be enqueued', async () => {
    enqueue.mockRejectedValueOnce(new Error('redis offline'))

    const error = expectErr(
      await queueWorkspaceDeletion({
        ...input,
        workspace: { ...input.workspace, status: 'SUSPENDED' },
      }),
      'INTERNAL_SERVER_ERROR',
    )

    expect(error.message).toContain('Nada foi apagado')
    expect(operationRepo.markFailed).toHaveBeenCalledWith(
      'op1',
      'redis offline',
    )
    expect(workspaceRepo.setStatus).toHaveBeenLastCalledWith('ws1', {
      status: 'SUSPENDED',
    })
    expect(logger.error).toHaveBeenCalledWith(
      'workspace.delete_enqueue_failed',
      expect.objectContaining({ workspaceId: 'ws1', message: 'redis offline' }),
    )
  })

  it('stringifies non-Error enqueue failures', async () => {
    enqueue.mockRejectedValueOnce('boom')
    expectErr(await queueWorkspaceDeletion(input), 'INTERNAL_SERVER_ERROR')
    expect(operationRepo.markFailed).toHaveBeenCalledWith('op1', 'boom')
  })
})

describe('invalidateWorkspaceCaches()', () => {
  it('swallows cache failures', async () => {
    vi.mocked(WorkspaceCache.invalidate).mockRejectedValueOnce(
      new Error('redis down'),
    )
    await expect(invalidateWorkspaceCaches('ws1')).resolves.toBeUndefined()
  })
})
