import { describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeProfile } from '@/src/__tests__/factories/profile.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/profile.repository')

import { MembershipRepository } from '@/src/repositories/membership.repository'
import { ProfileRepository } from '@/src/repositories/profile.repository'
import { ProfileService } from '../profile.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedProfileRepo = vi.mocked(ProfileRepository)

describe('ProfileService', () => {
  describe('list()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await ProfileService.list('u1', 'ws1'), 'FORBIDDEN')
    })

    it('should seed system profiles and return them sorted (system first)', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'OWNER' })),
      )
      mockedProfileRepo.ensureSystemProfiles.mockResolvedValue(
        ok([
          createFakeProfile({ name: 'Custom', isSystem: false }),
          createFakeProfile({ name: 'Proprietário', isSystem: true }),
        ]),
      )

      const list = expectOk(await ProfileService.list('u1', 'ws1'))
      expect(list[0].isSystem).toBe(true)
      expect(list[1].isSystem).toBe(false)
    })
  })

  describe('create()', () => {
    it('should return PROFILE_NAME_TAKEN when the name already exists', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'OWNER' })),
      )
      mockedProfileRepo.existsByName.mockResolvedValue(ok(true))

      expectErr(
        await ProfileService.create('u1', 'ws1', {
          name: 'Vendedor',
          permissions: {},
        }),
        'PROFILE_NAME_TAKEN',
      )
    })

    it('should sanitize permissions before persisting', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'OWNER' })),
      )
      mockedProfileRepo.existsByName.mockResolvedValue(ok(false))
      mockedProfileRepo.create.mockResolvedValue(ok(createFakeProfile()))

      expectOk(
        await ProfileService.create('u1', 'ws1', {
          name: 'Vendedor',
          permissions: {
            companies: ['VIEW', 'FLY' as unknown as 'VIEW'],
          },
        }),
      )
      expect(mockedProfileRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          permissions: { companies: ['VIEW'] },
        }),
      )
    })
  })

  describe('update()', () => {
    it('should return PROFILE_SYSTEM_PROTECTED for a system profile', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'OWNER' })),
      )
      mockedProfileRepo.findById.mockResolvedValue(
        ok(createFakeProfile({ id: 'p1', workspaceId: 'ws1', isSystem: true })),
      )

      expectErr(
        await ProfileService.update('u1', 'ws1', 'p1', { name: 'Novo' }),
        'PROFILE_SYSTEM_PROTECTED',
      )
    })
  })

  describe('remove()', () => {
    it('should return PROFILE_IN_USE when memberships reference the profile', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'OWNER' })),
      )
      mockedProfileRepo.findById.mockResolvedValue(
        ok(
          createFakeProfile({ id: 'p1', workspaceId: 'ws1', isSystem: false }),
        ),
      )
      mockedProfileRepo.countMemberships.mockResolvedValue(ok(2))

      expectErr(
        await ProfileService.remove('u1', 'ws1', 'p1'),
        'PROFILE_IN_USE',
      )
    })

    it('should delete a custom profile with no memberships', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'OWNER' })),
      )
      mockedProfileRepo.findById.mockResolvedValue(
        ok(
          createFakeProfile({ id: 'p1', workspaceId: 'ws1', isSystem: false }),
        ),
      )
      mockedProfileRepo.countMemberships.mockResolvedValue(ok(0))
      mockedProfileRepo.delete.mockResolvedValue(ok(true))

      expectOk(await ProfileService.remove('u1', 'ws1', 'p1'))
      expect(mockedProfileRepo.delete).toHaveBeenCalledWith('p1')
    })
  })
})
