import { describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeProfile } from '@/src/__tests__/factories/profile.factory'
import { createFakeUser } from '@/src/__tests__/factories/user.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/user.repository')

import { MembershipRepository } from '@/src/repositories/membership.repository'
import { UserRepository } from '@/src/repositories/user.repository'
import { assertMember, assertPlatformAdmin } from '../authz'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedUserRepo = vi.mocked(UserRepository)

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

describe('assertPlatformAdmin()', () => {
  it('should deny a user without the isPlatformAdmin flag', async () => {
    mockedUserRepo.findById.mockResolvedValue(
      ok(
        createFakeUser({
          isPlatformAdmin: false,
          email: 'someone@stratustelecom.com.br',
        }),
      ),
    )
    expectErr(await assertPlatformAdmin('u1'), 'FORBIDDEN')
  })

  it('should deny a platform admin whose e-mail is outside the required domain', async () => {
    mockedUserRepo.findById.mockResolvedValue(
      ok(createFakeUser({ isPlatformAdmin: true, email: 'someone@gmail.com' })),
    )
    expectErr(await assertPlatformAdmin('u1'), 'FORBIDDEN')
  })

  it('should allow a user with the flag and the required e-mail domain', async () => {
    mockedUserRepo.findById.mockResolvedValue(
      ok(
        createFakeUser({
          isPlatformAdmin: true,
          email: 'alexandre@stratustelecom.com.br',
        }),
      ),
    )
    const ctx = expectOk(await assertPlatformAdmin('u1'))
    expect(ctx.email).toBe('alexandre@stratustelecom.com.br')
  })

  it('should propagate a not-found result untouched', async () => {
    mockedUserRepo.findById.mockResolvedValue(
      err({ code: 'RESOURCE_NOT_FOUND', message: 'User not found' }),
    )
    expectErr(await assertPlatformAdmin('u1'), 'RESOURCE_NOT_FOUND')
  })
})
