import type { Role } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeCrmTask } from '@/src/__tests__/factories/crm-task.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, notFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-task.repository')
vi.mock('@/src/repositories/crm-activity.repository')
vi.mock('@/src/services/crm-workflow-dispatcher')
vi.mock('@/lib/axiom/audit')

import { auditMutation } from '@/lib/axiom/audit'
import { CrmActivityRepository } from '@/src/repositories/crm-activity.repository'
import { CrmTaskRepository } from '@/src/repositories/crm-task.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { CrmTaskService } from '../crm-task.service'
import { dispatchCrmWorkflowRecordEvent } from '../crm-workflow-dispatcher'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedTaskRepo = vi.mocked(CrmTaskRepository)
const mockedActivityRepo = vi.mocked(CrmActivityRepository)
const mockedModuleAccess = vi.mocked(WorkspaceModuleAccessRepository)
const mockedDispatch = vi.mocked(dispatchCrmWorkflowRecordEvent)
const mockedAudit = vi.mocked(auditMutation)

function asRole(role: Role) {
  mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role })),
  )
}

beforeEach(() => {
  mockedModuleAccess.isEnabled.mockResolvedValue(ok(true))
  mockedActivityRepo.record.mockResolvedValue(ok({} as never))
  mockedDispatch.mockResolvedValue(undefined)
})

describe('CrmTaskService', () => {
  describe('authorization gates', () => {
    it('should propagate a membership lookup database error', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        err(databaseError()),
      )
      expectErr(await CrmTaskService.list('u1', 'ws1', {}), 'DATABASE_ERROR')
    })

    it('should return MODULE_DISABLED when the CRM module is off', async () => {
      asRole('OWNER')
      mockedModuleAccess.isEnabled.mockResolvedValue(ok(false))
      expectErr(await CrmTaskService.list('u1', 'ws1', {}), 'MODULE_DISABLED')
      expect(mockedTaskRepo.listByWorkspace).not.toHaveBeenCalled()
    })

    it('should return WORKSPACE_SUSPENDED for a suspended workspace', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(
          createFakeMembership({ role: 'OWNER', workspaceStatus: 'SUSPENDED' }),
        ),
      )
      expectErr(
        await CrmTaskService.create('u1', 'ws1', {
          title: 'x',
          status: 'TODO',
        }),
        'WORKSPACE_SUSPENDED',
      )
    })

    it.each([
      ['VIEWER', 'create'],
      ['VIEWER', 'update'],
      ['VIEWER', 'remove'],
      ['VIEWER', 'reorder'],
      ['MEMBER', 'remove'],
    ] as const)('should deny %s on %s', async (role, action) => {
      asRole(role)
      const calls = {
        create: () =>
          CrmTaskService.create('u1', 'ws1', { title: 'x', status: 'TODO' }),
        update: () => CrmTaskService.update('u1', 'ws1', 't1', { title: 'y' }),
        remove: () => CrmTaskService.remove('u1', 'ws1', 't1'),
        reorder: () => CrmTaskService.reorder('u1', 'ws1', ['t1']),
      }
      expectErr(await calls[action](), 'FORBIDDEN')
      expect(mockedTaskRepo.create).not.toHaveBeenCalled()
      expect(mockedTaskRepo.update).not.toHaveBeenCalled()
      expect(mockedTaskRepo.softDelete).not.toHaveBeenCalled()
      expect(mockedTaskRepo.reorder).not.toHaveBeenCalled()
    })
  })

  describe('list()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await CrmTaskService.list('u1', 'ws1', {}), 'FORBIDDEN')
    })

    it('should return tasks for a viewer', async () => {
      asRole('VIEWER')
      mockedTaskRepo.listByWorkspace.mockResolvedValue(
        ok([createFakeCrmTask({ workspaceId: 'ws1' })]),
      )

      const dtos = expectOk(
        await CrmTaskService.list('u1', 'ws1', { status: 'TODO' }),
      )
      expect(dtos).toHaveLength(1)
      expect(mockedTaskRepo.listByWorkspace).toHaveBeenCalledWith('ws1', {
        status: 'TODO',
      })
    })

    it('should propagate repository errors', async () => {
      asRole('MEMBER')
      mockedTaskRepo.listByWorkspace.mockResolvedValue(err(databaseError()))
      expectErr(await CrmTaskService.list('u1', 'ws1', {}), 'DATABASE_ERROR')
    })
  })

  describe('create()', () => {
    it('should persist, audit, record activity and dispatch workflows', async () => {
      asRole('MEMBER')
      mockedTaskRepo.create.mockResolvedValue(
        ok(createFakeCrmTask({ id: 't1', title: 'Ligar' })),
      )

      const dto = expectOk(
        await CrmTaskService.create('u1', 'ws1', {
          title: 'Ligar',
          status: 'TODO',
          assigneeId: 'u2',
        }),
      )

      expect(dto.id).toBe('t1')
      expect(mockedTaskRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws1',
          createdById: 'u1',
          title: 'Ligar',
          assigneeId: 'u2',
        }),
      )
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create', targetId: 't1' }),
      )
      expect(mockedActivityRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({ entity: 'task', action: 'CREATED' }),
      )
      expect(mockedDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ entity: 'task', event: 'created' }),
      )
    })

    it('should audit a failure and skip side effects on repository error', async () => {
      asRole('MEMBER')
      mockedTaskRepo.create.mockResolvedValue(err(databaseError()))

      expectErr(
        await CrmTaskService.create('u1', 'ws1', {
          title: 'x',
          status: 'TODO',
        }),
        'DATABASE_ERROR',
      )
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'failure',
          reason: 'DATABASE_ERROR',
        }),
      )
      expect(mockedActivityRepo.record).not.toHaveBeenCalled()
      expect(mockedDispatch).not.toHaveBeenCalled()
    })
  })

  describe('update()', () => {
    it('should update an existing task and emit side effects', async () => {
      asRole('MEMBER')
      mockedTaskRepo.findById.mockResolvedValue(
        ok(createFakeCrmTask({ id: 't1' })),
      )
      mockedTaskRepo.update.mockResolvedValue(
        ok(createFakeCrmTask({ id: 't1', title: 'Novo', status: 'DONE' })),
      )

      const dto = expectOk(
        await CrmTaskService.update('u1', 'ws1', 't1', {
          title: 'Novo',
          status: 'DONE',
        }),
      )

      expect(dto.title).toBe('Novo')
      expect(mockedTaskRepo.findById).toHaveBeenCalledWith('t1', 'ws1')
      expect(mockedTaskRepo.update).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({ title: 'Novo', updatedById: 'u1' }),
      )
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          meta: { fields: ['title', 'status'] },
        }),
      )
      expect(mockedActivityRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATED' }),
      )
      expect(mockedDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'updated' }),
      )
    })

    it('should return NOT_FOUND for a task outside the workspace', async () => {
      asRole('MEMBER')
      mockedTaskRepo.findById.mockResolvedValue(err(notFound('Task')))

      expectErr(
        await CrmTaskService.update('u1', 'ws1', 't1', { title: 'x' }),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedTaskRepo.update).not.toHaveBeenCalled()
    })

    it('should propagate an update error without side effects', async () => {
      asRole('ADMIN')
      mockedTaskRepo.findById.mockResolvedValue(ok(createFakeCrmTask()))
      mockedTaskRepo.update.mockResolvedValue(err(databaseError()))

      expectErr(
        await CrmTaskService.update('u1', 'ws1', 't1', { title: 'x' }),
        'DATABASE_ERROR',
      )
      expect(mockedAudit).not.toHaveBeenCalled()
      expect(mockedDispatch).not.toHaveBeenCalled()
    })
  })

  describe('remove()', () => {
    it('should soft-delete for an admin and emit side effects', async () => {
      asRole('ADMIN')
      mockedTaskRepo.findById.mockResolvedValue(
        ok(createFakeCrmTask({ id: 't1', title: 'Ligar' })),
      )
      mockedTaskRepo.softDelete.mockResolvedValue(ok(undefined as never))

      expectOk(await CrmTaskService.remove('u1', 'ws1', 't1'))

      expect(mockedTaskRepo.softDelete).toHaveBeenCalledWith('t1')
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'delete', targetId: 't1' }),
      )
      expect(mockedActivityRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETED',
          entityId: 't1',
          summary: 'removeu Tarefa Ligar',
        }),
      )
      expect(mockedDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'deleted' }),
      )
    })

    it('should return NOT_FOUND when the task does not exist', async () => {
      asRole('OWNER')
      mockedTaskRepo.findById.mockResolvedValue(err(notFound('Task')))

      expectErr(
        await CrmTaskService.remove('u1', 'ws1', 't1'),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedTaskRepo.softDelete).not.toHaveBeenCalled()
    })

    it('should propagate a soft-delete error', async () => {
      asRole('OWNER')
      mockedTaskRepo.findById.mockResolvedValue(ok(createFakeCrmTask()))
      mockedTaskRepo.softDelete.mockResolvedValue(err(databaseError()))

      expectErr(
        await CrmTaskService.remove('u1', 'ws1', 't1'),
        'DATABASE_ERROR',
      )
      expect(mockedAudit).not.toHaveBeenCalled()
      expect(mockedActivityRepo.record).not.toHaveBeenCalled()
    })
  })

  describe('reorder()', () => {
    it('should delegate to the repository for a member', async () => {
      asRole('MEMBER')
      mockedTaskRepo.reorder.mockResolvedValue(ok(undefined))

      expectOk(await CrmTaskService.reorder('u1', 'ws1', ['t2', 't1']))
      expect(mockedTaskRepo.reorder).toHaveBeenCalledWith('ws1', ['t2', 't1'])
    })

    it('should propagate repository errors', async () => {
      asRole('MEMBER')
      mockedTaskRepo.reorder.mockResolvedValue(err(databaseError()))

      expectErr(
        await CrmTaskService.reorder('u1', 'ws1', ['t1']),
        'DATABASE_ERROR',
      )
    })
  })
})
