import { describe, expect, it, vi } from 'vitest'
import { seedMembership } from '@/src/__tests__/factories/membership.factory'
import { seedProfile } from '@/src/__tests__/factories/profile.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { SYSTEM_PROFILE_PERMISSIONS } from '@/src/lib/permissions'
import { prisma } from '@/src/lib/prisma'
import { ProfileRepository } from '../profile.repository'

describe('ProfileRepository', () => {
  describe('listByWorkspace()', () => {
    it('should list only the workspace profiles, system first then by name', async () => {
      const [workspace, other] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
      ])
      await seedProfile(workspace.id, { name: 'Zeta' })
      await seedProfile(workspace.id, { name: 'Alfa' })
      await seedProfile(workspace.id, {
        name: 'Sistema',
        isSystem: true,
        systemKey: 'VIEWER',
      })
      await seedProfile(other.id, { name: 'Outro' })

      const list = expectOk(
        await ProfileRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((p) => p.name)).toEqual(['Sistema', 'Alfa', 'Zeta'])
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.profile, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(await ProfileRepository.listByWorkspace('w'), 'DATABASE_ERROR')
    })
  })

  describe('findById()', () => {
    it('should return the profile or null', async () => {
      const workspace = await seedWorkspace()
      const profile = await seedProfile(workspace.id)

      expect(expectOk(await ProfileRepository.findById(profile.id))?.id).toBe(
        profile.id,
      )
      expect(expectOk(await ProfileRepository.findById('missing'))).toBeNull()
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.profile, 'findUnique').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(await ProfileRepository.findById('x'), 'DATABASE_ERROR')
    })
  })

  describe('create() / update() / delete()', () => {
    it('should create a non-system profile, update and delete it', async () => {
      const workspace = await seedWorkspace()

      const created = expectOk(
        await ProfileRepository.create({
          workspaceId: workspace.id,
          name: 'Vendedor',
          permissions: { companies: ['VIEW'] },
        }),
      )
      expect(created.isSystem).toBe(false)

      const updated = expectOk(
        await ProfileRepository.update(created.id, {
          name: 'Gerente',
          permissions: { companies: ['VIEW', 'EDIT'] },
        }),
      )
      expect(updated.name).toBe('Gerente')
      expect(updated.permissions).toEqual({ companies: ['VIEW', 'EDIT'] })

      expect(expectOk(await ProfileRepository.delete(created.id))).toBe(true)
      expect(
        await prisma.profile.findUnique({ where: { id: created.id } }),
      ).toBeNull()
    })

    it('should return DATABASE_ERROR when the workspace does not exist', async () => {
      expectErr(
        await ProfileRepository.create({
          workspaceId: 'missing',
          name: 'X',
          permissions: {},
        }),
        'DATABASE_ERROR',
      )
    })

    it('should return DATABASE_ERROR when updating or deleting a missing profile', async () => {
      expectErr(
        await ProfileRepository.update('missing', { name: 'X' }),
        'DATABASE_ERROR',
      )
      expectErr(await ProfileRepository.delete('missing'), 'DATABASE_ERROR')
    })
  })

  describe('existsByName()', () => {
    it('should detect a name collision within the workspace', async () => {
      const workspace = await seedWorkspace()
      await seedProfile(workspace.id, { name: 'Vendedor' })

      const taken = expectOk(
        await ProfileRepository.existsByName(workspace.id, 'Vendedor'),
      )
      expect(taken).toBe(true)
    })

    it('should exclude the given id', async () => {
      const workspace = await seedWorkspace()
      const profile = await seedProfile(workspace.id, { name: 'Vendedor' })

      const taken = expectOk(
        await ProfileRepository.existsByName(
          workspace.id,
          'Vendedor',
          profile.id,
        ),
      )
      expect(taken).toBe(false)
    })
  })

  describe('existsByName() errors', () => {
    it('should return DATABASE_ERROR when the count throws', async () => {
      vi.spyOn(prisma.profile, 'count').mockRejectedValueOnce(new Error('boom'))
      expectErr(
        await ProfileRepository.existsByName('w', 'x'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('countMemberships()', () => {
    it('should return DATABASE_ERROR when the count throws', async () => {
      vi.spyOn(prisma.membership, 'count').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(await ProfileRepository.countMemberships('p'), 'DATABASE_ERROR')
    })

    it('should count memberships linked to the profile', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const profile = await seedProfile(workspace.id)
      await seedMembership({ userId: user.id, workspaceId: workspace.id })

      const before = expectOk(
        await ProfileRepository.countMemberships(profile.id),
      )
      expect(before).toBe(0)
    })
  })

  describe('ensureSystemProfiles()', () => {
    it('should leave legacy key-less system profiles and orphan memberships untouched', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      for (const name of ['A', 'B', 'C', 'D']) {
        await seedProfile(workspace.id, {
          name,
          isSystem: true,
          systemKey: null,
          permissions: { legacy: ['VIEW'] },
        })
      }
      const membership = await seedMembership({
        userId: user.id,
        workspaceId: workspace.id,
      })

      const profiles = expectOk(
        await ProfileRepository.ensureSystemProfiles(workspace.id),
      )

      expect(profiles).toHaveLength(4)
      expect(profiles.every((p) => p.systemKey === null)).toBe(true)
      expect(profiles[0].permissions).toEqual({ legacy: ['VIEW'] })
      const stored = await prisma.membership.findUniqueOrThrow({
        where: { id: membership.id },
      })
      expect(stored.profileId).toBeNull()
    })

    it('should return DATABASE_ERROR when the lookup throws', async () => {
      vi.spyOn(prisma.profile, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await ProfileRepository.ensureSystemProfiles('w'),
        'DATABASE_ERROR',
      )
    })

    it('should seed the 4 system profiles idempotently and link orphan memberships', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedMembership({
        userId: user.id,
        workspaceId: workspace.id,
        role: 'ADMIN',
      })

      const first = expectOk(
        await ProfileRepository.ensureSystemProfiles(workspace.id),
      )
      expect(first.filter((p) => p.isSystem)).toHaveLength(4)

      const second = expectOk(
        await ProfileRepository.ensureSystemProfiles(workspace.id),
      )
      expect(second.filter((p) => p.isSystem)).toHaveLength(4)
    })

    it('should link a VIEWER membership to the Visualizador profile', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const membership = await seedMembership({
        userId: user.id,
        workspaceId: workspace.id,
        role: 'VIEWER',
      })

      const profiles = expectOk(
        await ProfileRepository.ensureSystemProfiles(workspace.id),
      )
      const viewer = profiles.find((p) => p.systemKey === 'VIEWER')
      expect(viewer?.name).toBe('Visualizador')

      const linked = await prisma.membership.findUnique({
        where: { id: membership.id },
      })
      expect(linked?.profileId).toBe(viewer?.id)
    })

    it('should resync a stale system profile matrix with the code', async () => {
      const workspace = await seedWorkspace()
      await seedProfile(workspace.id, {
        name: 'Membro',
        isSystem: true,
        systemKey: 'MEMBER',
        permissions: { companies: ['VIEW'] },
      })

      const profiles = expectOk(
        await ProfileRepository.ensureSystemProfiles(workspace.id),
      )
      const member = profiles.find((p) => p.systemKey === 'MEMBER')
      expect(member?.permissions).toEqual(SYSTEM_PROFILE_PERMISSIONS.MEMBER)
    })
  })
})
