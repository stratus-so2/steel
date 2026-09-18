import type { AdminOperation } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeUser } from '@/src/__tests__/factories/user.factory'
import { createFakeWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/user.repository')
vi.mock('@/src/repositories/workspace.repository')
vi.mock('@/src/repositories/admin-operation.repository')
vi.mock('@/src/lib/queue/database-backup', () => ({
  enqueueAdminOperation: vi.fn(),
}))
vi.mock('@/src/lib/admin-audit', () => ({ recordAdminAction: vi.fn() }))
vi.mock('@/src/cache/workspace.cache', () => ({
  WorkspaceCache: { invalidate: vi.fn(async () => undefined) },
}))
vi.mock('@/src/cache/workspace-features.cache', () => ({
  WorkspaceFeaturesCache: { invalidate: vi.fn(async () => undefined) },
}))

import { WorkspaceCache } from '@/src/cache/workspace.cache'
import { recordAdminAction } from '@/src/lib/admin-audit'
import { enqueueAdminOperation } from '@/src/lib/queue/database-backup'
import { AdminOperationRepository } from '@/src/repositories/admin-operation.repository'
import { UserRepository } from '@/src/repositories/user.repository'
import { WorkspaceRepository } from '@/src/repositories/workspace.repository'
import { AdminWorkspaceLifecycleService as Service } from '../admin-workspace-lifecycle.service'

const userRepo = vi.mocked(UserRepository)
const workspaceRepo = vi.mocked(WorkspaceRepository)
const operationRepo = vi.mocked(AdminOperationRepository)

const admin = createFakeUser({
  isPlatformAdmin: true,
  email: 'admin@stratustelecom.com.br',
})
const outsider = createFakeUser({ email: 'owner@cliente.com' })

function workspace(overrides: Parameters<typeof createFakeWorkspace>[0] = {}) {
  return {
    ...createFakeWorkspace({ id: 'ws1', slug: 'acme', ...overrides }),
    memberCount: 4,
  }
}

function fakeOperation(
  overrides: Partial<AdminOperation> = {},
): AdminOperation {
  const now = new Date()
  return {
    id: 'op1',
    kind: 'WORKSPACE_DELETE',
    status: 'QUEUED',
    step: 'queued',
    workspaceId: 'ws1',
    workspaceSlug: 'acme',
    workspaceName: 'Acme',
    backupId: null,
    requestedById: admin.id,
    requestedByEmail: admin.email,
    reason: 'encerramento do contrato',
    error: null,
    meta: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  userRepo.findById.mockResolvedValue(ok(admin))
  workspaceRepo.setStatus.mockImplementation(async (_id, data) =>
    ok(createFakeWorkspace({ id: 'ws1', slug: 'acme', ...data })),
  )
})

describe('AdminWorkspaceLifecycleService.suspend()', () => {
  it('denies a non-platform-admin', async () => {
    userRepo.findById.mockResolvedValue(ok(outsider))
    expectErr(
      await Service.suspend(outsider.id, 'ws1', 'motivo x'),
      'FORBIDDEN',
    )
    expect(workspaceRepo.setStatus).not.toHaveBeenCalled()
  })

  it('suspends an active workspace, invalidates the cache and audits', async () => {
    workspaceRepo.findWithMemberCount.mockResolvedValue(ok(workspace()))

    const dto = expectOk(
      await Service.suspend(admin.id, 'ws1', 'inadimplência'),
    )

    expect(dto.status).toBe('SUSPENDED')
    expect(workspaceRepo.setStatus).toHaveBeenCalledWith('ws1', {
      status: 'SUSPENDED',
      suspendedAt: expect.any(Date),
      suspendedReason: 'inadimplência',
      suspendedById: admin.id,
    })
    expect(WorkspaceCache.invalidate).toHaveBeenCalledWith('ws1')
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'workspace.suspend',
        audit: { entity: 'workspace', action: 'suspend' },
        reason: 'inadimplência',
        targetLabel: 'acme',
      }),
    )
  })

  it('rejects suspending twice', async () => {
    workspaceRepo.findWithMemberCount.mockResolvedValue(
      ok(workspace({ status: 'SUSPENDED' })),
    )
    expectErr(
      await Service.suspend(admin.id, 'ws1', 'de novo'),
      'WORKSPACE_STATUS_CONFLICT',
    )
  })

  it('returns not found for an unknown workspace', async () => {
    workspaceRepo.findWithMemberCount.mockResolvedValue(ok(null))
    expectErr(
      await Service.suspend(admin.id, 'nope', 'motivo x'),
      'RESOURCE_NOT_FOUND',
    )
  })
})

describe('AdminWorkspaceLifecycleService.reactivate()', () => {
  it('reactivates a suspended workspace and clears the suspension fields', async () => {
    workspaceRepo.findWithMemberCount.mockResolvedValue(
      ok(workspace({ status: 'SUSPENDED', suspendedReason: 'x' })),
    )

    const dto = expectOk(
      await Service.reactivate(admin.id, 'ws1', 'pagamento regularizado'),
    )

    expect(dto.status).toBe('ACTIVE')
    expect(workspaceRepo.setStatus).toHaveBeenCalledWith('ws1', {
      status: 'ACTIVE',
      suspendedAt: null,
      suspendedReason: null,
      suspendedById: null,
    })
  })

  it('rejects reactivating an active workspace', async () => {
    workspaceRepo.findWithMemberCount.mockResolvedValue(ok(workspace()))
    expectErr(
      await Service.reactivate(admin.id, 'ws1', 'motivo x'),
      'WORKSPACE_STATUS_CONFLICT',
    )
  })
})

describe('AdminWorkspaceLifecycleService.changePlan()', () => {
  it('changes the plan and audits from/to', async () => {
    workspaceRepo.findWithMemberCount.mockResolvedValue(ok(workspace()))
    workspaceRepo.setPlan.mockResolvedValue(
      ok(createFakeWorkspace({ id: 'ws1', activePlan: 'ENTERPRISE' })),
    )

    const dto = expectOk(
      await Service.changePlan(admin.id, 'ws1', {
        plan: 'ENTERPRISE',
        reason: 'contrato negociado',
      }),
    )

    expect(dto.activePlan).toBe('ENTERPRISE')
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'workspace.plan_change',
        meta: expect.objectContaining({ from: 'FREE', to: 'ENTERPRISE' }),
      }),
    )
  })

  it('rejects the same plan', async () => {
    workspaceRepo.findWithMemberCount.mockResolvedValue(ok(workspace()))
    expectErr(
      await Service.changePlan(admin.id, 'ws1', {
        plan: 'FREE',
        reason: 'motivo x',
      }),
      'WORKSPACE_STATUS_CONFLICT',
    )
    expect(workspaceRepo.setPlan).not.toHaveBeenCalled()
  })
})

describe('AdminWorkspaceLifecycleService.requestDeletion()', () => {
  const input = { confirmSlug: 'acme', reason: 'encerramento do contrato' }

  beforeEach(() => {
    workspaceRepo.findWithMemberCount.mockResolvedValue(ok(workspace()))
    operationRepo.findActiveByWorkspace.mockResolvedValue(ok(null))
    operationRepo.create.mockResolvedValue(ok(fakeOperation()))
    operationRepo.markFailed.mockResolvedValue(ok(undefined))
  })

  it('requires the exact slug', async () => {
    expectErr(
      await Service.requestDeletion(admin.id, 'ws1', {
        ...input,
        confirmSlug: 'ACME',
      }),
      'WORKSPACE_CONFIRMATION_MISMATCH',
    )
    expect(operationRepo.create).not.toHaveBeenCalled()
  })

  it('marks DELETING, enqueues the job and audits', async () => {
    const dto = expectOk(await Service.requestDeletion(admin.id, 'ws1', input))

    expect(dto).toMatchObject({ id: 'op1', status: 'QUEUED' })
    expect(operationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'WORKSPACE_DELETE',
        meta: { previousStatus: 'ACTIVE' },
        requestedByEmail: admin.email,
      }),
    )
    expect(workspaceRepo.setStatus).toHaveBeenCalledWith('ws1', {
      status: 'DELETING',
    })
    expect(enqueueAdminOperation).toHaveBeenCalledWith('delete', 'op1')
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'workspace.delete_requested' }),
    )
  })

  it('refuses while another operation is running', async () => {
    operationRepo.findActiveByWorkspace.mockResolvedValue(
      ok(fakeOperation({ status: 'RUNNING' })),
    )
    expectErr(
      await Service.requestDeletion(admin.id, 'ws1', input),
      'WORKSPACE_OPERATION_IN_PROGRESS',
    )
  })

  it('rolls the status back when the queue is unavailable', async () => {
    vi.mocked(enqueueAdminOperation).mockRejectedValueOnce(
      new Error('redis down'),
    )

    expectErr(
      await Service.requestDeletion(admin.id, 'ws1', input),
      'INTERNAL_SERVER_ERROR',
    )
    expect(operationRepo.markFailed).toHaveBeenCalledWith('op1', 'redis down')
    expect(workspaceRepo.setStatus).toHaveBeenLastCalledWith('ws1', {
      status: 'ACTIVE',
    })
  })
})
