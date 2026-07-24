import { describe, expect, it } from 'vitest'
import { seedMembership } from '@/src/__tests__/factories/membership.factory'
import { seedProfile } from '@/src/__tests__/factories/profile.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ProfileRepository } from '../profile.repository'

describe('ProfileRepository', () => {
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

  describe('countMemberships()', () => {
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
    it('should seed the 3 system profiles idempotently and link orphan memberships', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedMembership({
        userId: user.id,
        workspaceId: workspace.id,
        role: 'ADMIN',
      })

      const first = expectOk(
        await ProfileRepository.ensureSystemProfiles(workspace.id),
      )
      expect(first.filter((p) => p.isSystem)).toHaveLength(3)

      const second = expectOk(
        await ProfileRepository.ensureSystemProfiles(workspace.id),
      )
      expect(second.filter((p) => p.isSystem)).toHaveLength(3)
    })
  })
})
