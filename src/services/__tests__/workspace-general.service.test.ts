import type { AdminOperation, Role } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, workspaceOperationInProgress } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/workspace.repository')
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/user.repository')
vi.mock('@/src/cache/workspace.cache')
vi.mock('@/src/cache/user.cache')
vi.mock('@/src/services/workspace-deletion', () => ({
  queueWorkspaceDeletion: vi.fn(),
}))
vi.mock('@/src/lib/admin-audit', () => ({ recordAdminAction: vi.fn() }))
vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))

import { auditMutation } from '@/lib/axiom/audit'
import { UserCache } from '@/src/cache/user.cache'
import { WorkspaceCache } from '@/src/cache/workspace.cache'
import { recordAdminAction } from '@/src/lib/admin-audit'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { UserRepository } from '@/src/repositories/user.repository'
import { WorkspaceRepository } from '@/src/repositories/workspace.repository'
import {
  OWNER_DELETION_REASON,
  refreshWorkspaceCaches,
  WorkspaceService,
} from '@/src/services/workspace.service'
import { queueWorkspaceDeletion } from '@/src/services/workspace-deletion'

const membershipRepo = vi.mocked(MembershipRepository)
const workspaceRepo = vi.mocked(WorkspaceRepository)
const userRepo = vi.mocked(UserRepository)
const queue = vi.mocked(queueWorkspaceDeletion)
const audit = vi.mocked(auditMutation)

const workspace = createFakeWorkspace({ id: 'ws1', slug: 'acme', name: 'Acme' })

function asRole(role: Role) {
  membershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ userId: 'u1', workspaceId: 'ws1', role })),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  asRole('OWNER')
  workspaceRepo.findById.mockResolvedValue(ok(workspace))
  membershipRepo.listUserByWorkspace.mockResolvedValue(ok(['u1', 'u2']))
})

describe('refreshWorkspaceCaches()', () => {
  it('invalidates the workspace and every member', async () => {
    await refreshWorkspaceCaches('ws1', 'u1')
    expect(WorkspaceCache.invalidate).toHaveBeenCalledWith('ws1')
    expect(UserCache.invalidate).toHaveBeenCalledWith('u1')
    expect(UserCache.invalidate).toHaveBeenCalledWith('u2')
  })

  it('falls back to the actor when members cannot be listed', async () => {
    membershipRepo.listUserByWorkspace.mockResolvedValue(err(databaseError()))
    await refreshWorkspaceCaches('ws1', 'u1')
    expect(UserCache.invalidate).toHaveBeenCalledTimes(1)
    expect(UserCache.invalidate).toHaveBeenCalledWith('u1')
  })
})

describe('WorkspaceService.update() — Ajustes > Geral', () => {
  it('saves the company size without reading the current slug', async () => {
    workspaceRepo.update.mockResolvedValue(
      ok({ ...workspace, companySize: 'SIZE_11_50' }),
    )

    const dto = expectOk(
      await WorkspaceService.update('u1', 'ws1', { companySize: 'SIZE_11_50' }),
    )

    expect(dto.companySize).toBe('SIZE_11_50')
    expect(workspaceRepo.findById).not.toHaveBeenCalled()
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ meta: { fields: ['companySize'] } }),
    )
  })

  it('audits the previous slug when the URL changes', async () => {
    asRole('ADMIN')
    workspaceRepo.update.mockResolvedValue(ok({ ...workspace, slug: 'acme-2' }))

    const dto = expectOk(
      await WorkspaceService.update('u1', 'ws1', { slug: 'acme-2' }),
    )

    expect(dto.slug).toBe('acme-2')
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'workspace',
        action: 'update',
        meta: { fields: ['slug'], previousSlug: 'acme', slug: 'acme-2' },
      }),
    )
    expect(UserCache.invalidate).toHaveBeenCalledWith('u2')
  })

  it('does not flag an unchanged slug', async () => {
    workspaceRepo.update.mockResolvedValue(ok(workspace))

    expectOk(await WorkspaceService.update('u1', 'ws1', { slug: 'acme' }))
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ meta: { fields: ['slug'] } }),
    )
  })

  it('propagates a failed lookup of the current slug', async () => {
    workspaceRepo.findById.mockResolvedValue(err(databaseError()))
    expectErr(
      await WorkspaceService.update('u1', 'ws1', { slug: 'acme-2' }),
      'DATABASE_ERROR',
    )
    expect(workspaceRepo.update).not.toHaveBeenCalled()
  })

  it.each(['MEMBER', 'VIEWER'] as Role[])('forbids a %s', async (role) => {
    asRole(role)
    expectErr(
      await WorkspaceService.update('u1', 'ws1', { name: 'X' }),
      'FORBIDDEN',
    )
    expect(workspaceRepo.update).not.toHaveBeenCalled()
  })
})

describe('WorkspaceService.checkSlugAvailability()', () => {
  it('reports a free slug', async () => {
    asRole('ADMIN')
    workspaceRepo.findBySlug.mockResolvedValue(ok(null))

    expect(
      expectOk(
        await WorkspaceService.checkSlugAvailability('u1', 'ws1', 'novo'),
      ),
    ).toEqual({ slug: 'novo', available: true, reason: null, message: null })
  })

  it('treats the current slug as available', async () => {
    workspaceRepo.findBySlug.mockResolvedValue(ok(workspace))
    const value = expectOk(
      await WorkspaceService.checkSlugAvailability('u1', 'ws1', 'acme'),
    )
    expect(value).toMatchObject({ available: true, reason: 'current' })
  })

  it('reports a slug taken by another workspace', async () => {
    workspaceRepo.findBySlug.mockResolvedValue(
      ok(createFakeWorkspace({ id: 'other', slug: 'taken' })),
    )
    const value = expectOk(
      await WorkspaceService.checkSlugAvailability('u1', 'ws1', 'taken'),
    )
    expect(value).toMatchObject({ available: false, reason: 'taken' })
    expect(value.message).toContain('em uso')
  })

  it('reports reserved words without hitting the database', async () => {
    const value = expectOk(
      await WorkspaceService.checkSlugAvailability('u1', 'ws1', 'admin'),
    )
    expect(value).toMatchObject({ available: false, reason: 'reserved' })
    expect(workspaceRepo.findBySlug).not.toHaveBeenCalled()
  })

  it('reports an invalid format', async () => {
    const value = expectOk(
      await WorkspaceService.checkSlugAvailability('u1', 'ws1', 'Acme Co'),
    )
    expect(value).toMatchObject({ available: false, reason: 'invalid' })
    expect(value.message).toContain('minúsculas')
  })

  it('propagates repository errors', async () => {
    workspaceRepo.findBySlug.mockResolvedValue(err(databaseError()))
    expectErr(
      await WorkspaceService.checkSlugAvailability('u1', 'ws1', 'novo'),
      'DATABASE_ERROR',
    )
  })

  it('forbids a MEMBER and a non-member', async () => {
    asRole('MEMBER')
    expectErr(
      await WorkspaceService.checkSlugAvailability('u1', 'ws1', 'novo'),
      'FORBIDDEN',
    )
    membershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
    expectErr(
      await WorkspaceService.checkSlugAvailability('u1', 'ws1', 'novo'),
      'FORBIDDEN',
    )
  })
})

describe('WorkspaceService.requestDeletion()', () => {
  const operation = {
    id: 'op1',
    createdAt: new Date('2026-10-08T12:00:00Z'),
  } as AdminOperation

  beforeEach(() => {
    userRepo.findById.mockResolvedValue(
      ok({ id: 'u1', email: 'owner@acme.test' } as never),
    )
    queue.mockResolvedValue(ok(operation))
  })

  it('queues the shared deletion pipeline for the OWNER', async () => {
    const value = expectOk(
      await WorkspaceService.requestDeletion('u1', 'ws1', {
        confirmation: 'acme',
      }),
    )

    expect(value).toEqual({
      operationId: 'op1',
      status: 'QUEUED',
      requestedAt: '2026-10-08T12:00:00.000Z',
    })
    expect(queue).toHaveBeenCalledWith({
      workspace,
      requester: { userId: 'u1', email: 'owner@acme.test' },
      reason: OWNER_DELETION_REASON,
      ignoreSubscriptionCancelFailure: false,
    })
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'workspace.delete_requested',
        audit: { entity: 'workspace', action: 'delete' },
        targetId: 'ws1',
        meta: { operationId: 'op1', requestedBy: 'owner' },
      }),
    )
    expect(UserCache.invalidate).toHaveBeenCalledWith('u2')
  })

  it.each(['ADMIN', 'MEMBER', 'VIEWER'] as Role[])(
    'forbids a %s',
    async (role) => {
      asRole(role)
      const error = expectErr(
        await WorkspaceService.requestDeletion('u1', 'ws1', {
          confirmation: 'acme',
        }),
        'FORBIDDEN',
      )
      expect(error.message).toContain('OWNER')
      expect(queue).not.toHaveBeenCalled()
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'delete',
          outcome: 'failure',
          reason: 'insufficient_role',
        }),
      )
    },
  )

  it('forbids a non-member', async () => {
    membershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
    expectErr(
      await WorkspaceService.requestDeletion('u1', 'ws1', {
        confirmation: 'acme',
      }),
      'FORBIDDEN',
    )
  })

  it('requires the exact slug as confirmation', async () => {
    expectErr(
      await WorkspaceService.requestDeletion('u1', 'ws1', {
        confirmation: 'Acme',
      }),
      'WORKSPACE_CONFIRMATION_MISMATCH',
    )
    expect(queue).not.toHaveBeenCalled()
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'confirmation_mismatch' }),
    )
  })

  it('propagates lookup errors', async () => {
    workspaceRepo.findById.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await WorkspaceService.requestDeletion('u1', 'ws1', {
        confirmation: 'acme',
      }),
      'DATABASE_ERROR',
    )

    userRepo.findById.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await WorkspaceService.requestDeletion('u1', 'ws1', {
        confirmation: 'acme',
      }),
      'DATABASE_ERROR',
    )
    expect(queue).not.toHaveBeenCalled()
  })

  it('audits and returns pipeline failures', async () => {
    queue.mockResolvedValue(err(workspaceOperationInProgress()))

    expectErr(
      await WorkspaceService.requestDeletion('u1', 'ws1', {
        confirmation: 'acme',
      }),
      'WORKSPACE_OPERATION_IN_PROGRESS',
    )
    expect(recordAdminAction).not.toHaveBeenCalled()
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'failure',
        reason: 'WORKSPACE_OPERATION_IN_PROGRESS',
      }),
    )
  })
})
