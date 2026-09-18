import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { seedWorkspaceFeatureOverride } from '@/src/__tests__/factories/workspace-feature-override.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { WorkspaceFeatureOverrideRepository } from '../workspace-feature-override.repository'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('WorkspaceFeatureOverrideRepository', () => {
  describe('listByWorkspace()', () => {
    it('should list only the overrides of the given workspace', async () => {
      const [workspaceA, workspaceB, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      await seedWorkspaceFeatureOverride(workspaceA.id, user.id, {
        key: 'crm.aiAssistant',
      })
      await seedWorkspaceFeatureOverride(workspaceA.id, user.id, {
        key: 'communication.broadcasts',
      })
      await seedWorkspaceFeatureOverride(workspaceB.id, user.id)

      const list = expectOk(
        await WorkspaceFeatureOverrideRepository.listByWorkspace(workspaceA.id),
      )

      expect(list).toHaveLength(2)
      expect(list.every((o) => o.workspaceId === workspaceA.id)).toBe(true)
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(
        prisma.workspaceFeatureOverride,
        'findMany',
      ).mockRejectedValueOnce(new Error('boom'))
      expectErr(
        await WorkspaceFeatureOverrideRepository.listByWorkspace('ws1'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('upsert()', () => {
    it('should create then update the same workspace/key pair', async () => {
      const [workspace, admin, otherAdmin] = await Promise.all([
        seedWorkspace(),
        seedUser(),
        seedUser(),
      ])
      const expiresAt = new Date(Date.now() + 86_400_000)

      const created = expectOk(
        await WorkspaceFeatureOverrideRepository.upsert({
          workspaceId: workspace.id,
          key: 'crm.socialPublishing',
          enabled: true,
          note: 'Piloto',
          expiresAt,
          updatedById: admin.id,
        }),
      )
      expect(created.enabled).toBe(true)
      expect(created.note).toBe('Piloto')
      expect(created.expiresAt?.toISOString()).toBe(expiresAt.toISOString())

      const updated = expectOk(
        await WorkspaceFeatureOverrideRepository.upsert({
          workspaceId: workspace.id,
          key: 'crm.socialPublishing',
          enabled: false,
          note: null,
          expiresAt: null,
          updatedById: otherAdmin.id,
        }),
      )
      expect(updated.id).toBe(created.id)
      expect(updated.enabled).toBe(false)
      expect(updated.note).toBeNull()
      expect(updated.expiresAt).toBeNull()
      expect(updated.updatedById).toBe(otherAdmin.id)
    })

    it('should return DATABASE_ERROR when the workspace does not exist', async () => {
      const admin = await seedUser()
      expectErr(
        await WorkspaceFeatureOverrideRepository.upsert({
          workspaceId: 'nonexistent-workspace',
          key: 'crm.aiAssistant',
          enabled: true,
          note: null,
          expiresAt: null,
          updatedById: admin.id,
        }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('remove()', () => {
    it('should delete the override and report whether one existed', async () => {
      const [workspace, admin] = await Promise.all([
        seedWorkspace(),
        seedUser(),
      ])
      await seedWorkspaceFeatureOverride(workspace.id, admin.id)

      expect(
        expectOk(
          await WorkspaceFeatureOverrideRepository.remove(
            workspace.id,
            'crm.aiAssistant',
          ),
        ),
      ).toBe(true)
      expect(
        expectOk(
          await WorkspaceFeatureOverrideRepository.remove(
            workspace.id,
            'crm.aiAssistant',
          ),
        ),
      ).toBe(false)
    })
  })

  it('should keep the override when the admin account is deleted', async () => {
    const [workspace, admin] = await Promise.all([seedWorkspace(), seedUser()])
    await seedWorkspaceFeatureOverride(workspace.id, admin.id)

    await prisma.user.delete({ where: { id: admin.id } })

    const list = expectOk(
      await WorkspaceFeatureOverrideRepository.listByWorkspace(workspace.id),
    )
    expect(list).toHaveLength(1)
    expect(list[0].updatedById).toBeNull()
  })
})
