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
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import {
  assertMember,
  assertModuleEnabled,
  assertModuleMember,
  assertPlatformAdmin,
} from '../authz'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedUserRepo = vi.mocked(UserRepository)
const mockedModuleAccessRepo = vi.mocked(WorkspaceModuleAccessRepository)

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

describe('assertMember() — Visualizador e negação por padrão', () => {
  it('should let a VIEWER read but never create, edit or delete', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'VIEWER' })),
    )
    expectOk(
      await assertMember('u1', 'ws1', {
        resource: 'companies',
        action: 'VIEW',
      }),
    )
    for (const action of ['CREATE', 'EDIT', 'DELETE'] as const) {
      expectErr(
        await assertMember('u1', 'ws1', { resource: 'companies', action }),
        'FORBIDDEN',
      )
    }
  })

  it('should block a VIEWER from managing profiles and member access', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'VIEWER' })),
    )
    expectErr(
      await assertMember('u1', 'ws1', { resource: 'members', action: 'EDIT' }),
      'FORBIDDEN',
    )
    expectErr(
      await assertMember('u1', 'ws1', { resource: 'members', action: 'VIEW' }),
      'FORBIDDEN',
    )
  })

  it('should deny a resource the profile does not list at all', async () => {
    const profile = createFakeProfile({ permissions: {} })
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'MEMBER', profile })),
    )
    expectErr(
      await assertMember('u1', 'ws1', {
        resource: 'companies',
        action: 'VIEW',
      }),
      'FORBIDDEN',
    )
  })

  it('should deny when a custom profile has no permission map', async () => {
    const profile = createFakeProfile({ permissions: null as never })
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'MEMBER', profile })),
    )
    expectErr(
      await assertMember('u1', 'ws1', {
        resource: 'companies',
        action: 'VIEW',
      }),
      'FORBIDDEN',
    )
  })

  it('should resolve a system profile from the code matrix, not the stored snapshot', async () => {
    // Snapshot antigo, anterior aos recursos da Comunicação.
    const profile = createFakeProfile({
      isSystem: true,
      systemKey: 'MEMBER',
      permissions: { companies: ['VIEW'] },
    })
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'MEMBER', profile })),
    )
    expectOk(
      await assertMember('u1', 'ws1', {
        resource: 'conversations',
        action: 'CREATE',
      }),
    )
  })
})

describe('assertModuleEnabled()', () => {
  it('should pass when the module is enabled', async () => {
    mockedModuleAccessRepo.isEnabled.mockResolvedValueOnce(ok(true))
    expectOk(await assertModuleEnabled('ws1', 'CRM'))
    expect(mockedModuleAccessRepo.isEnabled).toHaveBeenCalledWith('ws1', 'CRM')
  })

  it('should return MODULE_DISABLED when the module is off', async () => {
    mockedModuleAccessRepo.isEnabled.mockResolvedValueOnce(ok(false))
    expectErr(await assertModuleEnabled('ws1', 'CRM'), 'MODULE_DISABLED')
  })

  it('should propagate a database error', async () => {
    mockedModuleAccessRepo.isEnabled.mockResolvedValueOnce(
      err({ code: 'DATABASE_ERROR', message: 'boom' }),
    )
    expectErr(await assertModuleEnabled('ws1', 'CRM'), 'DATABASE_ERROR')
  })
})

describe('assertModuleMember()', () => {
  it('should return FORBIDDEN for a non-member without revealing module state', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
    expectErr(await assertModuleMember('u1', 'ws1', 'CRM'), 'FORBIDDEN')
    expect(mockedModuleAccessRepo.isEnabled).not.toHaveBeenCalled()
  })

  it('should return MODULE_DISABLED for a member when the module is off, even for OWNER', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'OWNER' })),
    )
    mockedModuleAccessRepo.isEnabled.mockResolvedValueOnce(ok(false))
    expectErr(
      await assertModuleMember('u1', 'ws1', 'COMMUNICATION', {
        resource: 'conversations',
        action: 'VIEW',
      }),
      'MODULE_DISABLED',
    )
  })

  it('should apply the permission matrix once the module is enabled', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'MEMBER' })),
    )
    expectOk(
      await assertModuleMember('u1', 'ws1', 'CRM', {
        resource: 'companies',
        action: 'EDIT',
      }),
    )
    expectErr(
      await assertModuleMember('u1', 'ws1', 'CRM', {
        resource: 'companies',
        action: 'DELETE',
      }),
      'FORBIDDEN',
    )
  })

  it('should allow OWNER/ADMIN any action in an enabled module', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'ADMIN' })),
    )
    expectOk(
      await assertModuleMember('u1', 'ws1', 'COMMUNICATION', {
        resource: 'broadcasts',
        action: 'CREATE',
      }),
    )
  })

  it('should pass on membership + module alone when no requirement is given', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'VIEWER' })),
    )
    expectOk(await assertModuleMember('u1', 'ws1', 'CRM'))
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
