import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeProfile } from '@/src/__tests__/factories/profile.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

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

  describe('Visualizador (VIEWER)', () => {
    it('should forbid a VIEWER from creating, updating or deleting profiles', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'VIEWER' })),
      )

      expectErr(
        await ProfileService.create('u1', 'ws1', {
          name: 'Vendedor',
          permissions: {},
        }),
        'FORBIDDEN',
      )
      expectErr(
        await ProfileService.update('u1', 'ws1', 'p1', { name: 'X' }),
        'FORBIDDEN',
      )
      expectErr(await ProfileService.remove('u1', 'ws1', 'p1'), 'FORBIDDEN')
      expect(mockedProfileRepo.create).not.toHaveBeenCalled()
      expect(mockedProfileRepo.update).not.toHaveBeenCalled()
      expect(mockedProfileRepo.delete).not.toHaveBeenCalled()
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

describe('ProfileService — edge cases', () => {
  const dbError = err(databaseError('boom'))
  const custom = (overrides = {}) =>
    createFakeProfile({
      id: 'p1',
      workspaceId: 'ws1',
      name: 'Vendas',
      isSystem: false,
      ...overrides,
    })

  beforeEach(() => {
    vi.clearAllMocks()
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'ADMIN' })),
    )
  })

  describe('list()', () => {
    it('should sort custom and system profiles by name within each group', async () => {
      mockedProfileRepo.ensureSystemProfiles.mockResolvedValue(
        ok([
          custom({ id: 'c2', name: 'Suporte' }),
          createFakeProfile({ name: 'Visualizador', isSystem: true }),
          custom({ id: 'c1', name: 'Comercial' }),
          createFakeProfile({ name: 'Administrador', isSystem: true }),
        ]),
      )

      const list = expectOk(await ProfileService.list('u1', 'ws1'))

      expect(list.map((p) => p.name)).toEqual([
        'Administrador',
        'Visualizador',
        'Comercial',
        'Suporte',
      ])
    })

    it('should propagate a seeding error', async () => {
      mockedProfileRepo.ensureSystemProfiles.mockResolvedValue(dbError)

      expectErr(await ProfileService.list('u1', 'ws1'), 'DATABASE_ERROR')
    })
  })

  describe('create()', () => {
    it('should propagate errors from the name check and the insert', async () => {
      mockedProfileRepo.existsByName.mockResolvedValueOnce(dbError)
      expectErr(
        await ProfileService.create('u1', 'ws1', {
          name: 'X',
          permissions: {},
        }),
        'DATABASE_ERROR',
      )

      mockedProfileRepo.existsByName.mockResolvedValueOnce(ok(false))
      mockedProfileRepo.create.mockResolvedValueOnce(dbError)
      expectErr(
        await ProfileService.create('u1', 'ws1', {
          name: 'X',
          permissions: {},
        }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('update()', () => {
    it('should rename and sanitize permissions of a custom profile', async () => {
      mockedProfileRepo.findById.mockResolvedValue(ok(custom()))
      mockedProfileRepo.existsByName.mockResolvedValue(ok(false))
      mockedProfileRepo.update.mockResolvedValue(
        ok(custom({ name: 'Vendas B2B' })),
      )

      const dto = expectOk(
        await ProfileService.update('u1', 'ws1', 'p1', {
          name: 'Vendas B2B',
          permissions: { crm: ['VIEW'] },
        }),
      )

      expect(dto.name).toBe('Vendas B2B')
      expect(mockedProfileRepo.existsByName).toHaveBeenCalledWith(
        'ws1',
        'Vendas B2B',
        'p1',
      )
      expect(mockedProfileRepo.update).toHaveBeenCalledWith('p1', {
        name: 'Vendas B2B',
        permissions: expect.any(Object),
      })
    })

    it('should skip the name check when the name is unchanged or absent', async () => {
      mockedProfileRepo.findById.mockResolvedValue(ok(custom()))
      mockedProfileRepo.update.mockResolvedValue(ok(custom()))

      expectOk(
        await ProfileService.update('u1', 'ws1', 'p1', { name: 'Vendas' }),
      )
      expectOk(await ProfileService.update('u1', 'ws1', 'p1', {}))

      expect(mockedProfileRepo.existsByName).not.toHaveBeenCalled()
      expect(mockedProfileRepo.update).toHaveBeenLastCalledWith('p1', {})
    })

    it('should reject a name already used by another profile', async () => {
      mockedProfileRepo.findById.mockResolvedValue(ok(custom()))
      mockedProfileRepo.existsByName.mockResolvedValue(ok(true))

      expectErr(
        await ProfileService.update('u1', 'ws1', 'p1', { name: 'Suporte' }),
        'PROFILE_NAME_TAKEN',
      )
      expect(mockedProfileRepo.update).not.toHaveBeenCalled()
    })

    it('should return PROFILE_NOT_FOUND for a profile of another workspace', async () => {
      mockedProfileRepo.findById.mockResolvedValue(
        ok(custom({ workspaceId: 'ws2' })),
      )

      expectErr(
        await ProfileService.update('u1', 'ws1', 'p1', { name: 'X' }),
        'PROFILE_NOT_FOUND',
      )
    })

    it('should propagate lookup, name-check and update errors', async () => {
      mockedProfileRepo.findById.mockResolvedValueOnce(dbError)
      expectErr(
        await ProfileService.update('u1', 'ws1', 'p1', { name: 'X' }),
        'DATABASE_ERROR',
      )

      mockedProfileRepo.findById.mockResolvedValue(ok(custom()))
      mockedProfileRepo.existsByName.mockResolvedValueOnce(dbError)
      expectErr(
        await ProfileService.update('u1', 'ws1', 'p1', { name: 'X' }),
        'DATABASE_ERROR',
      )

      mockedProfileRepo.update.mockResolvedValueOnce(dbError)
      expectErr(
        await ProfileService.update('u1', 'ws1', 'p1', {}),
        'DATABASE_ERROR',
      )
    })
  })

  describe('remove()', () => {
    it('should protect system profiles and missing ones', async () => {
      mockedProfileRepo.findById.mockResolvedValueOnce(
        ok(custom({ isSystem: true })),
      )
      expectErr(
        await ProfileService.remove('u1', 'ws1', 'p1'),
        'PROFILE_SYSTEM_PROTECTED',
      )

      mockedProfileRepo.findById.mockResolvedValueOnce(ok(null))
      expectErr(
        await ProfileService.remove('u1', 'ws1', 'p1'),
        'PROFILE_NOT_FOUND',
      )
      expect(mockedProfileRepo.delete).not.toHaveBeenCalled()
    })

    it('should propagate lookup and count errors', async () => {
      mockedProfileRepo.findById.mockResolvedValueOnce(dbError)
      expectErr(
        await ProfileService.remove('u1', 'ws1', 'p1'),
        'DATABASE_ERROR',
      )

      mockedProfileRepo.findById.mockResolvedValue(ok(custom()))
      mockedProfileRepo.countMemberships.mockResolvedValueOnce(dbError)
      expectErr(
        await ProfileService.remove('u1', 'ws1', 'p1'),
        'DATABASE_ERROR',
      )
    })

    it('should forbid non-members', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))

      expectErr(await ProfileService.remove('u1', 'ws1', 'p1'), 'FORBIDDEN')
    })
  })
})
