import type { Role } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeProfile } from '@/src/__tests__/factories/profile.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')

import { MembershipRepository } from '@/src/repositories/membership.repository'
import { SdAccessRepository } from '@/src/repositories/sd-access.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { SdAccess } from '../sd-access'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedAccessRepo = vi.mocked(SdAccessRepository)
const mockedModuleAccess = vi.mocked(WorkspaceModuleAccessRepository)

function asRole(
  role: Role,
  profile = null as ReturnType<typeof createFakeProfile> | null,
) {
  mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role, profile })),
  )
}

beforeEach(() => {
  mockedModuleAccess.isEnabled.mockResolvedValue(ok(true))
  mockedAccessRepo.listDepartmentLinks.mockResolvedValue(ok([]))
})

describe('SdAccess.resolve', () => {
  it('checks the SERVICE_DESK module and returns MODULE_DISABLED when off', async () => {
    asRole('OWNER')
    mockedModuleAccess.isEnabled.mockResolvedValue(ok(false))
    expectErr(await SdAccess.resolve('u1', 'ws1'), 'MODULE_DISABLED')
    expect(mockedModuleAccess.isEnabled).toHaveBeenCalledWith(
      'ws1',
      'SERVICE_DESK',
    )
  })

  it('denies a MEMBER without the required permission', async () => {
    asRole('VIEWER')
    expectErr(
      await SdAccess.resolve('u1', 'ws1', {
        resource: 'sd-tickets',
        action: 'CREATE',
      }),
      'FORBIDDEN',
    )
  })

  it('treats a MEMBER without departments as a requester', async () => {
    asRole('MEMBER')
    const ctx = expectOk(await SdAccess.resolve('u1', 'ws1'))
    expect(ctx).toMatchObject({
      userId: 'u1',
      isAdmin: false,
      isAgent: false,
      departmentIds: [],
      leadDepartmentIds: [],
    })
  })

  it('treats a MEMBER in a department as an agent and lists lead departments', async () => {
    asRole('MEMBER')
    mockedAccessRepo.listDepartmentLinks.mockResolvedValue(
      ok([
        { departmentId: 'd1', parentId: null, isLead: true },
        { departmentId: 'd2', parentId: 'd1', isLead: false },
      ]),
    )
    const ctx = expectOk(await SdAccess.resolve('u1', 'ws1'))
    expect(ctx.isAgent).toBe(true)
    expect(ctx.departmentIds).toEqual(['d1', 'd2'])
    expect(ctx.leadDepartmentIds).toEqual(['d1'])
  })

  it('treats OWNER/ADMIN as admin and agent even without departments', async () => {
    asRole('ADMIN')
    const ctx = expectOk(await SdAccess.resolve('u1', 'ws1'))
    expect(ctx.isAdmin).toBe(true)
    expect(ctx.isAgent).toBe(true)
  })

  it('treats a custom profile with sd-settings:EDIT as admin', async () => {
    asRole(
      'MEMBER',
      createFakeProfile({ permissions: { 'sd-settings': ['VIEW', 'EDIT'] } }),
    )
    expect(expectOk(await SdAccess.resolve('u1', 'ws1')).isAdmin).toBe(true)
  })

  it('does not treat a profile without a permission map as admin', async () => {
    asRole('MEMBER', createFakeProfile({ permissions: null }))
    expect(expectOk(await SdAccess.resolve('u1', 'ws1')).isAdmin).toBe(false)
  })

  it('propagates a department lookup error', async () => {
    asRole('MEMBER')
    mockedAccessRepo.listDepartmentLinks.mockResolvedValue(err(databaseError()))
    expectErr(await SdAccess.resolve('u1', 'ws1'), 'DATABASE_ERROR')
  })
})

describe('SdAccess.requireAgent', () => {
  it('refuses a requester with SD_NOT_AGENT', async () => {
    asRole('MEMBER')
    expectErr(await SdAccess.requireAgent('u1', 'ws1'), 'SD_NOT_AGENT')
  })

  it('accepts an agent', async () => {
    asRole('MEMBER')
    mockedAccessRepo.listDepartmentLinks.mockResolvedValue(
      ok([{ departmentId: 'd1', parentId: null, isLead: false }]),
    )
    expect(expectOk(await SdAccess.requireAgent('u1', 'ws1')).isAgent).toBe(
      true,
    )
  })

  it('propagates authorization errors', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
    expectErr(await SdAccess.requireAgent('u1', 'ws1'), 'FORBIDDEN')
  })
})

describe('SdAccess.requireAdmin', () => {
  it('refuses a department agent that is not admin', async () => {
    asRole('MEMBER')
    mockedAccessRepo.listDepartmentLinks.mockResolvedValue(
      ok([{ departmentId: 'd1', parentId: null, isLead: true }]),
    )
    expectErr(await SdAccess.requireAdmin('u1', 'ws1'), 'FORBIDDEN')
  })

  it('accepts OWNER', async () => {
    asRole('OWNER')
    expect(expectOk(await SdAccess.requireAdmin('u1', 'ws1')).isAdmin).toBe(
      true,
    )
  })

  it('propagates authorization errors', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      err(databaseError()),
    )
    expectErr(await SdAccess.requireAdmin('u1', 'ws1'), 'DATABASE_ERROR')
  })
})
