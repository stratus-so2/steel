import { describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeProfile } from '@/src/__tests__/factories/profile.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')

import { MembershipRepository } from '@/src/repositories/membership.repository'
import { assertMember } from '../authz'

const mockedMembershipRepo = vi.mocked(MembershipRepository)

describe('assertMember()', () => {
  it('should return FORBIDDEN for a non-member', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
    expectErr(await assertMember('u1', 'ws1'), 'FORBIDDEN')
  })

  it('should pass without a permission requirement', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'MEMBER' })),
    )
    expectOk(await assertMember('u1', 'ws1'))
  })

  it('should always allow privileged roles, even without matching permissions', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'OWNER' })),
    )
    const ctx = expectOk(
      await assertMember('u1', 'ws1', {
        resource: 'settings',
        action: 'DELETE',
      }),
    )
    expect(ctx.isPrivileged).toBe(true)
  })

  it('should deny a MEMBER a resource/action not granted by the system MEMBER matrix', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'MEMBER' })),
    )
    expectErr(
      await assertMember('u1', 'ws1', { resource: 'members', action: 'EDIT' }),
      'FORBIDDEN',
    )
  })

  it('should allow a MEMBER a resource/action granted by the system MEMBER matrix', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'MEMBER' })),
    )
    expectOk(
      await assertMember('u1', 'ws1', {
        resource: 'companies',
        action: 'CREATE',
      }),
    )
  })

  it('should use the assigned profile permissions instead of the role fallback', async () => {
    const profile = createFakeProfile({
      permissions: { companies: ['VIEW'] },
    })
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'MEMBER', profile })),
    )
    expectOk(
      await assertMember('u1', 'ws1', {
        resource: 'companies',
        action: 'VIEW',
      }),
    )
    expectErr(
      await assertMember('u1', 'ws1', {
        resource: 'companies',
        action: 'DELETE',
      }),
      'FORBIDDEN',
    )
  })
})
