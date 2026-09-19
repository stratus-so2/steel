import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { ProfileRepository } from '@/src/repositories/profile.repository'
import { MembershipService } from '../membership.service'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/profile.repository')

const mockedMembership = vi.mocked(MembershipRepository)
const mockedProfile = vi.mocked(ProfileRepository)

const membershipWithWorkspace = {
  ...createFakeMembership({ userId: 'user1', workspaceId: 'ws1' }),
  workspace: createFakeWorkspace({ id: 'ws1', slug: 'acme' }),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MembershipService', () => {
  describe('getByUserAndSlug()', () => {
    it('should return the membership scoped to the user and slug', async () => {
      mockedMembership.findByUserAndSlug.mockResolvedValue(
        ok(membershipWithWorkspace),
      )

      const result = await MembershipService.getByUserAndSlug('user1', 'acme')

      expect(expectOk(result)?.workspaceId).toBe('ws1')
      expect(mockedMembership.findByUserAndSlug).toHaveBeenCalledWith(
        'user1',
        'acme',
      )
    })

    it('should propagate a repository error', async () => {
      mockedMembership.findByUserAndSlug.mockResolvedValue(
        err(databaseError('boom')),
      )

      const result = await MembershipService.getByUserAndSlug('user1', 'acme')

      expectErr(result, 'DATABASE_ERROR')
    })
  })

  describe('listByUser()', () => {
    it('should return every membership of the user', async () => {
      mockedMembership.listByUser.mockResolvedValue(
        ok([membershipWithWorkspace]),
      )

      const result = await MembershipService.listByUser('user1')

      expect(expectOk(result)).toHaveLength(1)
      expect(mockedMembership.listByUser).toHaveBeenCalledWith('user1')
    })
  })

  describe('countByWorkspace()', () => {
    it('should return the workspace member count', async () => {
      mockedMembership.countByWorkspace.mockResolvedValue(ok(3))

      const result = await MembershipService.countByWorkspace('ws1')

      expect(expectOk(result)).toBe(3)
      expect(mockedMembership.countByWorkspace).toHaveBeenCalledWith('ws1')
    })
  })
})

describe('setProfile() — Visualizador', () => {
  it('should forbid a VIEWER from changing another member profile', async () => {
    mockedMembership.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'VIEWER' })),
    )

    expectErr(
      await MembershipService.setProfile('viewer', 'ws1', 'other', null),
      'FORBIDDEN',
    )
    expect(mockedMembership.setProfile).not.toHaveBeenCalled()
  })

  it('should forbid a VIEWER from listing members with their access', async () => {
    mockedMembership.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'VIEWER' })),
    )

    expectErr(await MembershipService.listMembers('viewer', 'ws1'), 'FORBIDDEN')
  })
})

describe('listWithUserByWorkspace()', () => {
  it('should delegate to the repository', async () => {
    mockedMembership.listWithUserByWorkspace.mockResolvedValue(ok([]))

    expectOk(await MembershipService.listWithUserByWorkspace('ws1'))
    expect(mockedMembership.listWithUserByWorkspace).toHaveBeenCalledWith('ws1')
  })
})

describe('listMembers()', () => {
  const user = {
    id: 'user2',
    name: 'Bia',
    email: 'bia@example.com',
    image: null,
  }

  it('should list members with role and profile for an admin', async () => {
    mockedMembership.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'ADMIN' })),
    )
    mockedMembership.listWithUserByWorkspace.mockResolvedValue(
      ok([
        {
          ...createFakeMembership({
            userId: 'user2',
            role: 'MEMBER',
            profileId: 'p1',
          }),
          user,
        },
      ]),
    )

    const members = expectOk(
      await MembershipService.listMembers('admin', 'ws1'),
    )

    expect(members).toEqual([
      {
        userId: 'user2',
        name: 'Bia',
        email: 'bia@example.com',
        image: null,
        role: 'MEMBER',
        profileId: 'p1',
      },
    ])
  })

  it('should propagate a repository error when listing', async () => {
    mockedMembership.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'OWNER' })),
    )
    mockedMembership.listWithUserByWorkspace.mockResolvedValue(
      err(databaseError('boom')),
    )

    expectErr(
      await MembershipService.listMembers('owner', 'ws1'),
      'DATABASE_ERROR',
    )
  })

  it('should forbid non-members', async () => {
    mockedMembership.findByUserAndWorkspace.mockResolvedValue(ok(null))

    expectErr(
      await MembershipService.listMembers('stranger', 'ws1'),
      'FORBIDDEN',
    )
    expect(mockedMembership.listWithUserByWorkspace).not.toHaveBeenCalled()
  })
})

describe('setProfile()', () => {
  beforeEach(() => {
    mockedMembership.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'ADMIN' })),
    )
    mockedMembership.setProfile.mockResolvedValue(
      ok(createFakeMembership({ userId: 'user2', profileId: 'p1' })),
    )
  })

  it('should assign a profile that belongs to the workspace', async () => {
    mockedProfile.findById.mockResolvedValue(
      ok({ id: 'p1', workspaceId: 'ws1' } as never),
    )

    const updated = expectOk(
      await MembershipService.setProfile('admin', 'ws1', 'user2', 'p1'),
    )

    expect(updated.profileId).toBe('p1')
    expect(mockedMembership.setProfile).toHaveBeenCalledWith(
      'user2',
      'ws1',
      'p1',
    )
  })

  it('should clear the profile without looking it up', async () => {
    expectOk(await MembershipService.setProfile('admin', 'ws1', 'user2', null))

    expect(mockedProfile.findById).not.toHaveBeenCalled()
    expect(mockedMembership.setProfile).toHaveBeenCalledWith(
      'user2',
      'ws1',
      null,
    )
  })

  it('should reject a profile from another workspace or a missing one', async () => {
    mockedProfile.findById
      .mockResolvedValueOnce(ok({ id: 'p1', workspaceId: 'ws-other' } as never))
      .mockResolvedValueOnce(ok(null))

    expectErr(
      await MembershipService.setProfile('admin', 'ws1', 'user2', 'p1'),
      'PROFILE_NOT_FOUND',
    )
    expectErr(
      await MembershipService.setProfile('admin', 'ws1', 'user2', 'ghost'),
      'PROFILE_NOT_FOUND',
    )
    expect(mockedMembership.setProfile).not.toHaveBeenCalled()
  })

  it('should propagate a profile lookup error', async () => {
    mockedProfile.findById.mockResolvedValue(err(databaseError('boom')))

    expectErr(
      await MembershipService.setProfile('admin', 'ws1', 'user2', 'p1'),
      'DATABASE_ERROR',
    )
  })
})
