import { describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeProfile } from '@/src/__tests__/factories/profile.factory'
import { createFakeUser } from '@/src/__tests__/factories/user.factory'
import { createFakeWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

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

const platformAdmin = createFakeUser({
  isPlatformAdmin: true,
  email: 'admin@stratustelecom.com.br',
})
const regularUser = createFakeUser({
  isPlatformAdmin: false,
  email: 'user@example.com',
})

describe('AdminWorkspaceService', () => {
  describe('listWorkspaces()', () => {
    it('should deny a non-platform-admin actor', async () => {
      mockedUserRepo.findById.mockResolvedValue(ok(regularUser))

      expectErr(
        await AdminWorkspaceService.listWorkspaces(regularUser.id),
        'FORBIDDEN',
      )
      expect(mockedWorkspaceRepo.listAllWithCounts).not.toHaveBeenCalled()
    })

    it('should map workspaces to summary DTOs', async () => {
      mockedUserRepo.findById.mockResolvedValue(ok(platformAdmin))
      mockedWorkspaceRepo.listAllWithCounts.mockResolvedValue(
        ok([{ ...createFakeWorkspace({ name: 'Acme' }), memberCount: 3 }]),
      )

      const list = expectOk(
        await AdminWorkspaceService.listWorkspaces(platformAdmin.id),
      )
      expect(list).toHaveLength(1)
      expect(list[0].name).toBe('Acme')
      expect(list[0].memberCount).toBe(3)
    })
  })

  describe('getWorkspace()', () => {
    it('should deny a non-platform-admin actor', async () => {
      mockedUserRepo.findById.mockResolvedValue(ok(regularUser))

      expectErr(
        await AdminWorkspaceService.getWorkspace(regularUser.id, 'ws1'),
        'FORBIDDEN',
      )
      expect(mockedWorkspaceRepo.findById).not.toHaveBeenCalled()
    })
  })

  describe('listMembers()', () => {
    it('should deny a non-platform-admin actor', async () => {
      mockedUserRepo.findById.mockResolvedValue(ok(regularUser))

      expectErr(
        await AdminWorkspaceService.listMembers(regularUser.id, 'ws1'),
        'FORBIDDEN',
      )
      expect(
        mockedMembershipRepo.listWithUserByWorkspace,
      ).not.toHaveBeenCalled()
    })

    it('should map memberships to WorkspaceMemberDTO', async () => {
      mockedUserRepo.findById.mockResolvedValue(ok(platformAdmin))
      mockedMembershipRepo.listWithUserByWorkspace.mockResolvedValue(
        ok([
          {
            ...createFakeMembership({ role: 'OWNER' }),
            user: {
              id: 'u1',
              name: 'Alex',
              email: 'alex@example.com',
              image: null,
            },
          },
        ]),
      )

      const list = expectOk(
        await AdminWorkspaceService.listMembers(platformAdmin.id, 'ws1'),
      )
      expect(list).toEqual([
        {
          userId: 'u1',
          name: 'Alex',
          email: 'alex@example.com',
          image: null,
          role: 'OWNER',
          profileId: null,
        },
      ])
    })
  })

  describe('setMemberProfile()', () => {
    it('should deny a non-platform-admin actor', async () => {
      mockedUserRepo.findById.mockResolvedValue(ok(regularUser))

      expectErr(
        await AdminWorkspaceService.setMemberProfile(
          regularUser.id,
          'ws1',
          'u1',
          'p1',
        ),
        'FORBIDDEN',
      )
      expect(mockedMembershipRepo.setProfile).not.toHaveBeenCalled()
    })

    it('should return PROFILE_NOT_FOUND when the profile belongs to another workspace', async () => {
      mockedUserRepo.findById.mockResolvedValue(ok(platformAdmin))
      mockedProfileRepo.findById.mockResolvedValue(
        ok(createFakeProfile({ workspaceId: 'other-ws' })),
      )

      expectErr(
        await AdminWorkspaceService.setMemberProfile(
          platformAdmin.id,
          'ws1',
          'u1',
          'p1',
        ),
        'PROFILE_NOT_FOUND',
      )
    })
  })

  describe('listProfiles()', () => {
    it('should deny a non-platform-admin actor', async () => {
      mockedUserRepo.findById.mockResolvedValue(ok(regularUser))

      expectErr(
        await AdminWorkspaceService.listProfiles(regularUser.id, 'ws1'),
        'FORBIDDEN',
      )
      expect(mockedProfileRepo.ensureSystemProfiles).not.toHaveBeenCalled()
    })
  })

  describe('createProfile()', () => {
    it('should return PROFILE_NAME_TAKEN when the name already exists', async () => {
      mockedUserRepo.findById.mockResolvedValue(ok(platformAdmin))
      mockedProfileRepo.existsByName.mockResolvedValue(ok(true))

      expectErr(
        await AdminWorkspaceService.createProfile(platformAdmin.id, 'ws1', {
          name: 'Vendedor',
          permissions: {},
        }),
        'PROFILE_NAME_TAKEN',
      )
    })
  })

  describe('updateProfile()', () => {
    it('should return PROFILE_SYSTEM_PROTECTED for a system profile', async () => {
      mockedUserRepo.findById.mockResolvedValue(ok(platformAdmin))
      mockedProfileRepo.findById.mockResolvedValue(
        ok(createFakeProfile({ id: 'p1', workspaceId: 'ws1', isSystem: true })),
      )

      expectErr(
        await AdminWorkspaceService.updateProfile(
          platformAdmin.id,
          'ws1',
          'p1',
          { name: 'Novo' },
        ),
        'PROFILE_SYSTEM_PROTECTED',
      )
    })
  })

  describe('removeProfile()', () => {
    it('should return PROFILE_IN_USE when memberships reference the profile', async () => {
      mockedUserRepo.findById.mockResolvedValue(ok(platformAdmin))
      mockedProfileRepo.findById.mockResolvedValue(
        ok(
          createFakeProfile({ id: 'p1', workspaceId: 'ws1', isSystem: false }),
        ),
      )
      mockedProfileRepo.countMemberships.mockResolvedValue(ok(2))

      expectErr(
        await AdminWorkspaceService.removeProfile(
          platformAdmin.id,
          'ws1',
          'p1',
        ),
        'PROFILE_IN_USE',
      )
    })
  })
})
