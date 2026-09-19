import type { AdminOperation } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeUser } from '@/src/__tests__/factories/user.factory'
import { createFakeWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

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
import { AdminAuditLogRepository } from '@/src/repositories/admin-audit-log.repository'
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

describe('AdminWorkspaceLifecycleService — reads', () => {
  it('getDetail returns the workspace detail for a platform admin', async () => {
    workspaceRepo.findWithMemberCount.mockResolvedValue(ok(workspace()))

    const detail = expectOk(await Service.getDetail(admin.id, 'ws1'))

    expect(detail).toMatchObject({ id: 'ws1', slug: 'acme', memberCount: 4 })
  })

  it('getDetail denies outsiders and propagates lookup errors', async () => {
    userRepo.findById.mockResolvedValueOnce(ok(outsider))
    expectErr(await Service.getDetail(outsider.id, 'ws1'), 'FORBIDDEN')

    workspaceRepo.findWithMemberCount.mockResolvedValue(
      err(databaseError('down')),
    )
    expectErr(await Service.getDetail(admin.id, 'ws1'), 'DATABASE_ERROR')
  })

  it('listOperations applies the default limit and maps DTOs', async () => {
    operationRepo.listRecent.mockResolvedValue(ok([fakeOperation()]))

    const list = expectOk(await Service.listOperations(admin.id, {}))

    expect(list).toHaveLength(1)
    expect(operationRepo.listRecent).toHaveBeenCalledWith({
      workspaceId: undefined,
      limit: 20,
    })

    await Service.listOperations(admin.id, { workspaceId: 'ws1', limit: 5 })
    expect(operationRepo.listRecent).toHaveBeenLastCalledWith({
      workspaceId: 'ws1',
      limit: 5,
    })
  })

  it('listOperations denies outsiders and propagates errors', async () => {
    userRepo.findById.mockResolvedValueOnce(ok(outsider))
    expectErr(await Service.listOperations(outsider.id, {}), 'FORBIDDEN')

    operationRepo.listRecent.mockResolvedValue(err(databaseError('down')))
    expectErr(await Service.listOperations(admin.id, {}), 'DATABASE_ERROR')
  })

  it('getOperation returns the operation, 404 when missing', async () => {
    operationRepo.findById.mockResolvedValueOnce(ok(fakeOperation()))
    expect(expectOk(await Service.getOperation(admin.id, 'op1')).id).toBe('op1')

    operationRepo.findById.mockResolvedValueOnce(ok(null))
    expectErr(await Service.getOperation(admin.id, 'op1'), 'RESOURCE_NOT_FOUND')

    operationRepo.findById.mockResolvedValueOnce(err(databaseError('down')))
    expectErr(await Service.getOperation(admin.id, 'op1'), 'DATABASE_ERROR')

    userRepo.findById.mockResolvedValueOnce(ok(outsider))
    expectErr(await Service.getOperation(outsider.id, 'op1'), 'FORBIDDEN')
  })

  it('listAudit returns the last workspace audit entries', async () => {
    vi.mocked(AdminAuditLogRepository.listByTarget).mockResolvedValueOnce(
      ok([
        {
          id: 'a1',
          actorId: admin.id,
          actorEmail: admin.email,
          action: 'workspace.suspend',
          targetType: 'workspace',
          targetId: 'ws1',
          targetLabel: 'acme',
          reason: 'x',
          meta: null,
          createdAt: new Date(),
        },
      ]),
    )

    const entries = expectOk(await Service.listAudit(admin.id, 'ws1'))

    expect(entries[0]).toMatchObject({ id: 'a1', failed: false })
    expect(AdminAuditLogRepository.listByTarget).toHaveBeenCalledWith(
      'workspace',
      'ws1',
      30,
    )
  })

  it('listAudit denies outsiders and propagates errors', async () => {
    userRepo.findById.mockResolvedValueOnce(ok(outsider))
    expectErr(await Service.listAudit(outsider.id, 'ws1'), 'FORBIDDEN')

    vi.mocked(AdminAuditLogRepository.listByTarget).mockResolvedValueOnce(
      err(databaseError('down')),
    )
    expectErr(await Service.listAudit(admin.id, 'ws1'), 'DATABASE_ERROR')
  })
})

describe('AdminWorkspaceLifecycleService — mutation failure paths', () => {
  it('suspend rejects a workspace being deleted and propagates update errors', async () => {
    workspaceRepo.findWithMemberCount.mockResolvedValue(
      ok(workspace({ status: 'DELETING' })),
    )
    const deleting = expectErr(await Service.suspend(admin.id, 'ws1', 'x'))
    expect(deleting.message).toBe('O workspace está sendo excluído')

    workspaceRepo.findWithMemberCount.mockResolvedValue(ok(workspace()))
    workspaceRepo.setStatus.mockResolvedValueOnce(err(databaseError('down')))
    expectErr(await Service.suspend(admin.id, 'ws1', 'x'), 'DATABASE_ERROR')
    expect(recordAdminAction).not.toHaveBeenCalled()
  })

  it('suspend tolerates a cache invalidation failure', async () => {
    workspaceRepo.findWithMemberCount.mockResolvedValue(ok(workspace()))
    vi.mocked(WorkspaceCache.invalidate).mockRejectedValueOnce(
      new Error('redis down'),
    )

    expectOk(await Service.suspend(admin.id, 'ws1', 'x'))
    expect(recordAdminAction).toHaveBeenCalled()
  })

  it('reactivate denies outsiders and propagates lookup/update errors', async () => {
    userRepo.findById.mockResolvedValueOnce(ok(outsider))
    expectErr(await Service.reactivate(outsider.id, 'ws1', 'x'), 'FORBIDDEN')

    workspaceRepo.findWithMemberCount.mockResolvedValueOnce(
      err(databaseError('down')),
    )
    expectErr(await Service.reactivate(admin.id, 'ws1', 'x'), 'DATABASE_ERROR')

    workspaceRepo.findWithMemberCount.mockResolvedValue(
      ok(workspace({ status: 'SUSPENDED' })),
    )
    workspaceRepo.setStatus.mockResolvedValueOnce(err(databaseError('down')))
    expectErr(await Service.reactivate(admin.id, 'ws1', 'x'), 'DATABASE_ERROR')
  })

  it('changePlan covers outsider, lookup, DELETING and update failures', async () => {
    const input = { plan: 'PRO' as const, reason: 'upgrade manual' }
    userRepo.findById.mockResolvedValueOnce(ok(outsider))
    expectErr(await Service.changePlan(outsider.id, 'ws1', input), 'FORBIDDEN')

    workspaceRepo.findWithMemberCount.mockResolvedValueOnce(
      err(databaseError('down')),
    )
    expectErr(
      await Service.changePlan(admin.id, 'ws1', input),
      'DATABASE_ERROR',
    )

    workspaceRepo.findWithMemberCount.mockResolvedValueOnce(
      ok(workspace({ status: 'DELETING' })),
    )
    expectErr(
      await Service.changePlan(admin.id, 'ws1', input),
      'WORKSPACE_STATUS_CONFLICT',
    )

    workspaceRepo.findWithMemberCount.mockResolvedValue(
      ok(workspace({ activePlan: 'FREE' })),
    )
    workspaceRepo.setPlan.mockResolvedValueOnce(err(databaseError('down')))
    expectErr(
      await Service.changePlan(admin.id, 'ws1', input),
      'DATABASE_ERROR',
    )
    expect(recordAdminAction).not.toHaveBeenCalled()
  })

  it('requestDeletion covers outsider, lookup, active-op and create failures', async () => {
    const input = { confirmSlug: 'acme', reason: 'encerramento do contrato' }
    userRepo.findById.mockResolvedValueOnce(ok(outsider))
    expectErr(
      await Service.requestDeletion(outsider.id, 'ws1', input),
      'FORBIDDEN',
    )

    workspaceRepo.findWithMemberCount.mockResolvedValueOnce(
      err(databaseError('down')),
    )
    expectErr(
      await Service.requestDeletion(admin.id, 'ws1', input),
      'DATABASE_ERROR',
    )

    workspaceRepo.findWithMemberCount.mockResolvedValue(ok(workspace()))
    operationRepo.findActiveByWorkspace.mockResolvedValueOnce(
      err(databaseError('down')),
    )
    expectErr(
      await Service.requestDeletion(admin.id, 'ws1', input),
      'DATABASE_ERROR',
    )

    operationRepo.findActiveByWorkspace.mockResolvedValue(ok(null))
    operationRepo.create.mockResolvedValueOnce(err(databaseError('down')))
    expectErr(
      await Service.requestDeletion(admin.id, 'ws1', input),
      'DATABASE_ERROR',
    )
    expect(workspaceRepo.setStatus).not.toHaveBeenCalled()
  })

  it('requestDeletion marks the operation failed when the workspace cannot be flagged', async () => {
    workspaceRepo.findWithMemberCount.mockResolvedValue(ok(workspace()))
    operationRepo.findActiveByWorkspace.mockResolvedValue(ok(null))
    operationRepo.create.mockResolvedValue(ok(fakeOperation()))
    workspaceRepo.setStatus.mockResolvedValueOnce(err(databaseError('down')))

    expectErr(
      await Service.requestDeletion(admin.id, 'ws1', {
        confirmSlug: 'acme',
        reason: 'encerramento do contrato',
      }),
      'DATABASE_ERROR',
    )
    expect(operationRepo.markFailed).toHaveBeenCalledWith(
      'op1',
      'Falha ao marcar o workspace para exclusão',
    )
    expect(enqueueAdminOperation).not.toHaveBeenCalled()
  })

  it('requestDeletion records a non-Error enqueue failure message', async () => {
    workspaceRepo.findWithMemberCount.mockResolvedValue(ok(workspace()))
    operationRepo.findActiveByWorkspace.mockResolvedValue(ok(null))
    operationRepo.create.mockResolvedValue(ok(fakeOperation()))
    vi.mocked(enqueueAdminOperation).mockRejectedValueOnce('redis offline')

    expectErr(
      await Service.requestDeletion(admin.id, 'ws1', {
        confirmSlug: 'acme',
        reason: 'encerramento do contrato',
      }),
      'INTERNAL_SERVER_ERROR',
    )
    expect(operationRepo.markFailed).toHaveBeenCalledWith(
      'op1',
      'redis offline',
    )
  })
})
