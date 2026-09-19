import { describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeProfile } from '@/src/__tests__/factories/profile.factory'
import { createFakeUser } from '@/src/__tests__/factories/user.factory'
import { createFakeWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import type { AppError } from '@/src/errors/app-error'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/workspace.repository')
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/profile.repository')
vi.mock('@/src/repositories/user.repository')

import { MembershipRepository } from '@/src/repositories/membership.repository'
import { ProfileRepository } from '@/src/repositories/profile.repository'
import { UserRepository } from '@/src/repositories/user.repository'
import { WorkspaceRepository } from '@/src/repositories/workspace.repository'
import { AdminWorkspaceService } from '../admin-workspace.service'

const mockedWorkspaceRepo = vi.mocked(WorkspaceRepository)
const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedProfileRepo = vi.mocked(ProfileRepository)
const mockedUserRepo = vi.mocked(UserRepository)

const DB_ERROR: AppError = { code: 'DATABASE_ERROR', message: 'db down' }
const WS = 'ws1'

const platformAdmin = createFakeUser({
  id: 'admin1',
  isPlatformAdmin: true,
  email: 'root@stratustelecom.com.br',
})

function asPlatformAdmin() {
  mockedUserRepo.findById.mockResolvedValue(ok(platformAdmin))
}

function asRegularUser() {
  mockedUserRepo.findById.mockResolvedValue(
    ok(createFakeUser({ isPlatformAdmin: false })),
  )
}

function customProfile(
  overrides: Parameters<typeof createFakeProfile>[0] = {},
) {
  return createFakeProfile({
    id: 'p1',
    workspaceId: WS,
    name: 'Vendedor',
    isSystem: false,
    ...overrides,
  })
}

describe('AdminWorkspaceService — workspace reads', () => {
  it('listWorkspaces() should propagate a repository failure', async () => {
    asPlatformAdmin()
    mockedWorkspaceRepo.listAllWithCounts.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await AdminWorkspaceService.listWorkspaces('admin1'),
      'DATABASE_ERROR',
    )
  })

  it('listWorkspaces() should propagate a failure resolving the actor', async () => {
    mockedUserRepo.findById.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await AdminWorkspaceService.listWorkspaces('admin1'),
      'DATABASE_ERROR',
    )
  })

  it('getWorkspace() should return the workspace for a platform admin', async () => {
    asPlatformAdmin()
    const workspace = createFakeWorkspace({ id: WS, name: 'Acme' })
    mockedWorkspaceRepo.findById.mockResolvedValue(ok(workspace))

    expect(
      expectOk(await AdminWorkspaceService.getWorkspace('admin1', WS)),
    ).toBe(workspace)
    expect(mockedWorkspaceRepo.findById).toHaveBeenCalledWith(WS)
  })

  it('listMembers() should propagate a repository failure', async () => {
    asPlatformAdmin()
    mockedMembershipRepo.listWithUserByWorkspace.mockResolvedValue(
      err(DB_ERROR),
    )

    expectErr(
      await AdminWorkspaceService.listMembers('admin1', WS),
      'DATABASE_ERROR',
    )
  })
})

describe('AdminWorkspaceService.setMemberProfile()', () => {
  it('should assign a profile of the same workspace', async () => {
    asPlatformAdmin()
    mockedProfileRepo.findById.mockResolvedValue(ok(customProfile()))
    const membership = createFakeMembership({ profileId: 'p1' })
    mockedMembershipRepo.setProfile.mockResolvedValue(ok(membership))

    expect(
      expectOk(
        await AdminWorkspaceService.setMemberProfile('admin1', WS, 'u2', 'p1'),
      ),
    ).toBe(membership)
    expect(mockedMembershipRepo.setProfile).toHaveBeenCalledWith('u2', WS, 'p1')
  })

  it('should clear the profile without looking one up', async () => {
    asPlatformAdmin()
    mockedMembershipRepo.setProfile.mockResolvedValue(
      ok(createFakeMembership({ profileId: null })),
    )

    expectOk(
      await AdminWorkspaceService.setMemberProfile('admin1', WS, 'u2', null),
    )
    expect(mockedProfileRepo.findById).not.toHaveBeenCalled()
    expect(mockedMembershipRepo.setProfile).toHaveBeenCalledWith('u2', WS, null)
  })

  it('should propagate a profile lookup failure', async () => {
    asPlatformAdmin()
    mockedProfileRepo.findById.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await AdminWorkspaceService.setMemberProfile('admin1', WS, 'u2', 'p1'),
      'DATABASE_ERROR',
    )
  })

  it('should return PROFILE_NOT_FOUND for an unknown profile', async () => {
    asPlatformAdmin()
    mockedProfileRepo.findById.mockResolvedValue(ok(null))

    expectErr(
      await AdminWorkspaceService.setMemberProfile('admin1', WS, 'u2', 'p1'),
      'PROFILE_NOT_FOUND',
    )
    expect(mockedMembershipRepo.setProfile).not.toHaveBeenCalled()
  })
})

describe('AdminWorkspaceService.listProfiles()', () => {
  it('should seed system profiles and list them before custom ones, by name', async () => {
    asPlatformAdmin()
    mockedProfileRepo.ensureSystemProfiles.mockResolvedValue(
      ok([
        customProfile({ id: 'c2', name: 'Suporte' }),
        customProfile({ id: 's2', name: 'Membro', isSystem: true }),
        customProfile({ id: 'c1', name: 'Financeiro' }),
        customProfile({ id: 's1', name: 'Administrador', isSystem: true }),
      ]),
    )

    const profiles = expectOk(
      await AdminWorkspaceService.listProfiles('admin1', WS),
    )

    expect(profiles.map((p) => p.id)).toEqual(['s1', 's2', 'c1', 'c2'])
    expect(mockedProfileRepo.ensureSystemProfiles).toHaveBeenCalledWith(WS)
  })

  it('should propagate a seeding failure', async () => {
    asPlatformAdmin()
    mockedProfileRepo.ensureSystemProfiles.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await AdminWorkspaceService.listProfiles('admin1', WS),
      'DATABASE_ERROR',
    )
  })
})

describe('AdminWorkspaceService.createProfile()', () => {
  const input = {
    name: 'Financeiro',
    permissions: { companies: ['VIEW' as const], bogus: ['VIEW' as const] },
  }

  it('should deny a non-platform-admin actor', async () => {
    asRegularUser()

    expectErr(
      await AdminWorkspaceService.createProfile('u1', WS, input),
      'FORBIDDEN',
    )
  })

  it('should create a profile with sanitized permissions', async () => {
    asPlatformAdmin()
    mockedProfileRepo.existsByName.mockResolvedValue(ok(false))
    mockedProfileRepo.create.mockResolvedValue(
      ok(customProfile({ id: 'p9', name: 'Financeiro' })),
    )

    const dto = expectOk(
      await AdminWorkspaceService.createProfile('admin1', WS, input),
    )

    expect(dto.id).toBe('p9')
    expect(mockedProfileRepo.create).toHaveBeenCalledWith({
      workspaceId: WS,
      name: 'Financeiro',
      permissions: { companies: ['VIEW'] },
    })
  })

  it('should propagate a name lookup failure', async () => {
    asPlatformAdmin()
    mockedProfileRepo.existsByName.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await AdminWorkspaceService.createProfile('admin1', WS, input),
      'DATABASE_ERROR',
    )
  })

  it('should propagate a create failure', async () => {
    asPlatformAdmin()
    mockedProfileRepo.existsByName.mockResolvedValue(ok(false))
    mockedProfileRepo.create.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await AdminWorkspaceService.createProfile('admin1', WS, input),
      'DATABASE_ERROR',
    )
  })
})

describe('AdminWorkspaceService.updateProfile()', () => {
  it('should deny a non-platform-admin actor', async () => {
    asRegularUser()

    expectErr(
      await AdminWorkspaceService.updateProfile('u1', WS, 'p1', { name: 'X' }),
      'FORBIDDEN',
    )
  })

  it('should propagate a profile lookup failure', async () => {
    asPlatformAdmin()
    mockedProfileRepo.findById.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await AdminWorkspaceService.updateProfile('admin1', WS, 'p1', {
        name: 'X',
      }),
      'DATABASE_ERROR',
    )
  })

  it('should return PROFILE_NOT_FOUND for a profile of another workspace', async () => {
    asPlatformAdmin()
    mockedProfileRepo.findById.mockResolvedValue(
      ok(customProfile({ workspaceId: 'other' })),
    )

    expectErr(
      await AdminWorkspaceService.updateProfile('admin1', WS, 'p1', {
        name: 'X',
      }),
      'PROFILE_NOT_FOUND',
    )
  })

  it('should rename after checking the new name is free', async () => {
    asPlatformAdmin()
    mockedProfileRepo.findById.mockResolvedValue(ok(customProfile()))
    mockedProfileRepo.existsByName.mockResolvedValue(ok(false))
    mockedProfileRepo.update.mockResolvedValue(
      ok(customProfile({ name: 'Closer' })),
    )

    const dto = expectOk(
      await AdminWorkspaceService.updateProfile('admin1', WS, 'p1', {
        name: 'Closer',
      }),
    )

    expect(dto.name).toBe('Closer')
    expect(mockedProfileRepo.existsByName).toHaveBeenCalledWith(
      WS,
      'Closer',
      'p1',
    )
    expect(mockedProfileRepo.update).toHaveBeenCalledWith('p1', {
      name: 'Closer',
    })
  })

  it('should skip the name check when the name is unchanged', async () => {
    asPlatformAdmin()
    mockedProfileRepo.findById.mockResolvedValue(ok(customProfile()))
    mockedProfileRepo.update.mockResolvedValue(ok(customProfile()))

    expectOk(
      await AdminWorkspaceService.updateProfile('admin1', WS, 'p1', {
        name: 'Vendedor',
        permissions: { leads: ['VIEW'] },
      }),
    )

    expect(mockedProfileRepo.existsByName).not.toHaveBeenCalled()
    expect(mockedProfileRepo.update).toHaveBeenCalledWith('p1', {
      name: 'Vendedor',
      permissions: { leads: ['VIEW'] },
    })
  })

  it('should update only the permissions when no name is given', async () => {
    asPlatformAdmin()
    mockedProfileRepo.findById.mockResolvedValue(ok(customProfile()))
    mockedProfileRepo.update.mockResolvedValue(ok(customProfile()))

    expectOk(
      await AdminWorkspaceService.updateProfile('admin1', WS, 'p1', {
        permissions: { leads: ['VIEW'] },
      }),
    )

    expect(mockedProfileRepo.update).toHaveBeenCalledWith('p1', {
      permissions: { leads: ['VIEW'] },
    })
  })

  it('should return PROFILE_NAME_TAKEN when the new name is in use', async () => {
    asPlatformAdmin()
    mockedProfileRepo.findById.mockResolvedValue(ok(customProfile()))
    mockedProfileRepo.existsByName.mockResolvedValue(ok(true))

    expectErr(
      await AdminWorkspaceService.updateProfile('admin1', WS, 'p1', {
        name: 'Closer',
      }),
      'PROFILE_NAME_TAKEN',
    )
    expect(mockedProfileRepo.update).not.toHaveBeenCalled()
  })

  it('should propagate a name lookup failure', async () => {
    asPlatformAdmin()
    mockedProfileRepo.findById.mockResolvedValue(ok(customProfile()))
    mockedProfileRepo.existsByName.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await AdminWorkspaceService.updateProfile('admin1', WS, 'p1', {
        name: 'Closer',
      }),
      'DATABASE_ERROR',
    )
  })

  it('should propagate an update failure', async () => {
    asPlatformAdmin()
    mockedProfileRepo.findById.mockResolvedValue(ok(customProfile()))
    mockedProfileRepo.update.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await AdminWorkspaceService.updateProfile('admin1', WS, 'p1', {
        permissions: {},
      }),
      'DATABASE_ERROR',
    )
  })
})

describe('AdminWorkspaceService.removeProfile()', () => {
  it('should deny a non-platform-admin actor', async () => {
    asRegularUser()

    expectErr(
      await AdminWorkspaceService.removeProfile('u1', WS, 'p1'),
      'FORBIDDEN',
    )
  })

  it('should propagate a profile lookup failure', async () => {
    asPlatformAdmin()
    mockedProfileRepo.findById.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await AdminWorkspaceService.removeProfile('admin1', WS, 'p1'),
      'DATABASE_ERROR',
    )
  })

  it('should return PROFILE_SYSTEM_PROTECTED for a system profile', async () => {
    asPlatformAdmin()
    mockedProfileRepo.findById.mockResolvedValue(
      ok(customProfile({ isSystem: true })),
    )

    expectErr(
      await AdminWorkspaceService.removeProfile('admin1', WS, 'p1'),
      'PROFILE_SYSTEM_PROTECTED',
    )
    expect(mockedProfileRepo.delete).not.toHaveBeenCalled()
  })

  it('should propagate a membership count failure', async () => {
    asPlatformAdmin()
    mockedProfileRepo.findById.mockResolvedValue(ok(customProfile()))
    mockedProfileRepo.countMemberships.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await AdminWorkspaceService.removeProfile('admin1', WS, 'p1'),
      'DATABASE_ERROR',
    )
  })

  it('should delete an unused custom profile', async () => {
    asPlatformAdmin()
    mockedProfileRepo.findById.mockResolvedValue(ok(customProfile()))
    mockedProfileRepo.countMemberships.mockResolvedValue(ok(0))
    mockedProfileRepo.delete.mockResolvedValue(ok(true))

    expect(
      expectOk(await AdminWorkspaceService.removeProfile('admin1', WS, 'p1')),
    ).toBe(true)
    expect(mockedProfileRepo.delete).toHaveBeenCalledWith('p1')
  })
})
