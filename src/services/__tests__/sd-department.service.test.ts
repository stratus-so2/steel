import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-config.helpers'
import { databaseError, sdDepartmentNotFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import type { SdDepartmentWithMembers } from '@/src/repositories/sd-department.repository'
import { CreateSdDepartmentSchema } from '@/src/schemas/sd-department.schema'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-config.repository')
vi.mock('@/src/repositories/sd-department.repository')

import { auditMutation } from '@/lib/axiom/audit'
import { SdConfigRepository } from '@/src/repositories/sd-config.repository'
import { SdDepartmentRepository } from '@/src/repositories/sd-department.repository'
import { SdDepartmentService } from '../sd-department.service'

const repo = vi.mocked(SdDepartmentRepository)
const refs = vi.mocked(SdConfigRepository.findExistingRefs)

function deptRow(
  overrides: Partial<SdDepartmentWithMembers> = {},
): SdDepartmentWithMembers {
  const now = new Date('2026-01-01T00:00:00Z')
  return {
    id: 'd1',
    workspaceId: 'ws1',
    parentId: null,
    name: 'Service Desk',
    description: null,
    email: null,
    color: null,
    calendarId: null,
    active: true,
    position: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    members: [
      {
        id: 'm1',
        departmentId: 'd1',
        userId: 'u2',
        isLead: true,
        lastAssignedAt: null,
        createdAt: now,
        user: { id: 'u2', name: 'Ana', email: 'ana@x.com', image: null },
      },
    ],
    ...overrides,
  }
}

const input = CreateSdDepartmentSchema.parse({ name: 'N1', parentId: 'd1' })

beforeEach(() => {
  actAs('owner')
  refs.mockImplementation(async (_ws, wanted) => ok(wanted))
  repo.list.mockResolvedValue(ok([deptRow()]))
  repo.findById.mockResolvedValue(ok(deptRow()))
  repo.countChildren.mockResolvedValue(ok(0))
  repo.create.mockResolvedValue(ok(deptRow({ id: 'd2', parentId: 'd1' })))
  repo.update.mockResolvedValue(ok(deptRow()))
  repo.softDelete.mockResolvedValue(ok(undefined))
  repo.reorder.mockResolvedValue(ok(undefined))
  repo.upsertMember.mockResolvedValue(ok(undefined))
  repo.updateMember.mockResolvedValue(ok(undefined))
  repo.removeMember.mockResolvedValue(ok(undefined))
})

describe('SdDepartmentService.list', () => {
  it('lets any member read, with members', async () => {
    actAs('requester')
    const [dept] = expectOk(await SdDepartmentService.list('u1', 'ws1'))
    expect(dept.members[0]).toMatchObject({ userId: 'u2', isLead: true })
    expect(repo.list).toHaveBeenCalledWith('ws1', { includeInactive: false })
  })

  it('passes filters, refuses strangers, propagates db errors', async () => {
    expectOk(
      await SdDepartmentService.list('u1', 'ws1', { includeInactive: true }),
    )
    expect(repo.list).toHaveBeenCalledWith('ws1', { includeInactive: true })
    actAs('stranger')
    expectErr(await SdDepartmentService.list('u1', 'ws1'), 'FORBIDDEN')
    actAs('owner')
    repo.list.mockResolvedValue(err(databaseError()))
    expectErr(await SdDepartmentService.list('u1', 'ws1'), 'DATABASE_ERROR')
  })
})

describe('SdDepartmentService.create', () => {
  it('creates a sub-department under a root', async () => {
    const dto = expectOk(await SdDepartmentService.create('u1', 'ws1', input))
    expect(dto.id).toBe('d2')
    expect(repo.findById).toHaveBeenCalledWith('d1', 'ws1')
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'sd_department', targetId: 'd2' }),
    )
  })

  it('creates a root without checking a parent', async () => {
    expectOk(
      await SdDepartmentService.create(
        'u1',
        'ws1',
        CreateSdDepartmentSchema.parse({ name: 'Infra' }),
      ),
    )
    expect(repo.findById).not.toHaveBeenCalled()
  })

  it('refuses a third level', async () => {
    repo.findById.mockResolvedValue(ok(deptRow({ parentId: 'root' })))
    expectErr(
      await SdDepartmentService.create('u1', 'ws1', input),
      'SD_DEPARTMENT_DEPTH_EXCEEDED',
    )
  })

  it('returns not found for a foreign parent', async () => {
    repo.findById.mockResolvedValue(err(sdDepartmentNotFound()))
    expectErr(
      await SdDepartmentService.create('u1', 'ws1', input),
      'SD_DEPARTMENT_NOT_FOUND',
    )
  })

  it('rejects a foreign calendar and propagates db errors', async () => {
    refs.mockResolvedValue(ok({}))
    expectErr(
      await SdDepartmentService.create(
        'u1',
        'ws1',
        CreateSdDepartmentSchema.parse({ name: 'X', calendarId: 'c9' }),
      ),
      'SD_CONFIG_NOT_FOUND',
    )
    refs.mockImplementation(async (_ws, wanted) => ok(wanted))
    repo.create.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdDepartmentService.create('u1', 'ws1', input),
      'DATABASE_ERROR',
    )
  })

  it.each([
    ['requester', 'FORBIDDEN'],
    ['agent', 'FORBIDDEN'],
    ['lead', 'FORBIDDEN'],
    ['viewer', 'FORBIDDEN'],
    ['stranger', 'FORBIDDEN'],
    ['disabled', 'MODULE_DISABLED'],
  ] as const)('refuses %s', async (actor, code) => {
    actAs(actor)
    expectErr(await SdDepartmentService.create('u1', 'ws1', input), code)
  })
})

describe('SdDepartmentService.update', () => {
  it('updates plain fields', async () => {
    expectOk(
      await SdDepartmentService.update('u1', 'ws1', 'd1', { name: 'SD' }),
    )
    expect(repo.update).toHaveBeenCalledWith('d1', 'ws1', { name: 'SD' })
    expect(repo.countChildren).not.toHaveBeenCalled()
  })

  it('moves a leaf under a root', async () => {
    repo.findById
      .mockResolvedValueOnce(ok(deptRow({ id: 'd3' })))
      .mockResolvedValueOnce(ok(deptRow({ id: 'd1' })))
    expectOk(
      await SdDepartmentService.update('u1', 'ws1', 'd3', { parentId: 'd1' }),
    )
  })

  it('refuses to parent itself', async () => {
    expectErr(
      await SdDepartmentService.update('u1', 'ws1', 'd1', { parentId: 'd1' }),
      'SD_DEPARTMENT_DEPTH_EXCEEDED',
    )
  })

  it('refuses to move a department with children under another', async () => {
    repo.findById
      .mockResolvedValueOnce(ok(deptRow({ id: 'd3' })))
      .mockResolvedValueOnce(ok(deptRow({ id: 'd1' })))
    repo.countChildren.mockResolvedValue(ok(2))
    expectErr(
      await SdDepartmentService.update('u1', 'ws1', 'd3', { parentId: 'd1' }),
      'SD_DEPARTMENT_DEPTH_EXCEEDED',
    )
  })

  it('refuses a sub-department as parent and propagates errors', async () => {
    repo.findById
      .mockResolvedValueOnce(ok(deptRow({ id: 'd3' })))
      .mockResolvedValueOnce(ok(deptRow({ id: 'd4', parentId: 'd1' })))
    expectErr(
      await SdDepartmentService.update('u1', 'ws1', 'd3', { parentId: 'd4' }),
      'SD_DEPARTMENT_DEPTH_EXCEEDED',
    )
    repo.findById
      .mockResolvedValueOnce(ok(deptRow({ id: 'd3' })))
      .mockResolvedValueOnce(ok(deptRow({ id: 'd1' })))
    repo.countChildren.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdDepartmentService.update('u1', 'ws1', 'd3', { parentId: 'd1' }),
      'DATABASE_ERROR',
    )
  })

  it('returns not found, ref and db errors', async () => {
    repo.findById.mockResolvedValueOnce(err(sdDepartmentNotFound()))
    expectErr(
      await SdDepartmentService.update('u1', 'ws1', 'x', { name: 'a' }),
      'SD_DEPARTMENT_NOT_FOUND',
    )
    refs.mockResolvedValue(ok({}))
    expectErr(
      await SdDepartmentService.update('u1', 'ws1', 'd1', { calendarId: 'c' }),
      'SD_CONFIG_NOT_FOUND',
    )
    refs.mockImplementation(async (_ws, wanted) => ok(wanted))
    repo.update.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdDepartmentService.update('u1', 'ws1', 'd1', { name: 'a' }),
      'DATABASE_ERROR',
    )
  })
})

describe('SdDepartmentService.remove / reorder', () => {
  it('soft deletes', async () => {
    expectOk(await SdDepartmentService.remove('u1', 'ws1', 'd1'))
    expect(repo.softDelete).toHaveBeenCalledWith('d1', 'ws1')
    repo.findById.mockResolvedValue(err(sdDepartmentNotFound()))
    expectErr(
      await SdDepartmentService.remove('u1', 'ws1', 'd1'),
      'SD_DEPARTMENT_NOT_FOUND',
    )
  })

  it('reorders for admins', async () => {
    expectOk(await SdDepartmentService.reorder('u1', 'ws1', ['d2', 'd1']))
    expect(repo.reorder).toHaveBeenCalledWith('ws1', ['d2', 'd1'])
    actAs('agent')
    expectErr(
      await SdDepartmentService.reorder('u1', 'ws1', ['d1']),
      'FORBIDDEN',
    )
  })
})

describe('SdDepartmentService members', () => {
  it('adds a workspace member and returns the reloaded department', async () => {
    const dto = expectOk(
      await SdDepartmentService.addMember('u1', 'ws1', 'd1', {
        userId: 'u2',
        isLead: true,
      }),
    )
    expect(dto.id).toBe('d1')
    expect(repo.upsertMember).toHaveBeenCalledWith('d1', 'u2', true)
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_department_member',
        meta: expect.objectContaining({ userId: 'u2' }),
      }),
    )
  })

  it('refuses non-members and propagates errors on add', async () => {
    refs.mockResolvedValue(ok({}))
    expectErr(
      await SdDepartmentService.addMember('u1', 'ws1', 'd1', {
        userId: 'x',
        isLead: false,
      }),
      'SD_CONFIG_NOT_FOUND',
    )
    refs.mockImplementation(async (_ws, wanted) => ok(wanted))
    repo.upsertMember.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdDepartmentService.addMember('u1', 'ws1', 'd1', {
        userId: 'u2',
        isLead: false,
      }),
      'DATABASE_ERROR',
    )
    repo.findById.mockResolvedValue(err(sdDepartmentNotFound()))
    expectErr(
      await SdDepartmentService.addMember('u1', 'ws1', 'd1', {
        userId: 'u2',
        isLead: false,
      }),
      'SD_DEPARTMENT_NOT_FOUND',
    )
  })

  it('fails when the reload fails', async () => {
    repo.findById
      .mockResolvedValueOnce(ok(deptRow()))
      .mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdDepartmentService.addMember('u1', 'ws1', 'd1', {
        userId: 'u2',
        isLead: false,
      }),
      'DATABASE_ERROR',
    )
  })

  it('toggles the lead flag', async () => {
    expectOk(
      await SdDepartmentService.updateMember('u1', 'ws1', 'd1', 'u2', false),
    )
    expect(repo.updateMember).toHaveBeenCalledWith('d1', 'u2', false)
    repo.updateMember.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdDepartmentService.updateMember('u1', 'ws1', 'd1', 'u2', true),
      'DATABASE_ERROR',
    )
    repo.findById.mockResolvedValue(err(sdDepartmentNotFound()))
    expectErr(
      await SdDepartmentService.updateMember('u1', 'ws1', 'd1', 'u2', true),
      'SD_DEPARTMENT_NOT_FOUND',
    )
  })

  it('removes a member', async () => {
    expectOk(await SdDepartmentService.removeMember('u1', 'ws1', 'd1', 'u2'))
    expect(repo.removeMember).toHaveBeenCalledWith('d1', 'u2')
  })

  it('refuses to remove a non-member and propagates errors', async () => {
    const error = expectErr(
      await SdDepartmentService.removeMember('u1', 'ws1', 'd1', 'nobody'),
      'SD_DEPARTMENT_NOT_FOUND',
    )
    expect(error.message).toMatch(/não pertence/)
    repo.removeMember.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdDepartmentService.removeMember('u1', 'ws1', 'd1', 'u2'),
      'DATABASE_ERROR',
    )
    repo.findById.mockResolvedValue(err(sdDepartmentNotFound()))
    expectErr(
      await SdDepartmentService.removeMember('u1', 'ws1', 'd1', 'u2'),
      'SD_DEPARTMENT_NOT_FOUND',
    )
  })

  it('refuses agents on member changes', async () => {
    actAs('lead')
    expectErr(
      await SdDepartmentService.updateMember('u1', 'ws1', 'd1', 'u2', true),
      'FORBIDDEN',
    )
  })
})
