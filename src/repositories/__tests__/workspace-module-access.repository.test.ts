import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { seedWorkspaceModuleAccess } from '@/src/__tests__/factories/workspace-module-access.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { WorkspaceModuleAccessRepository } from '../workspace-module-access.repository'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('WorkspaceModuleAccessRepository', () => {
  describe('listByWorkspace()', () => {
    it('should list only the access rows of the given workspace', async () => {
      const [workspaceA, workspaceB, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      await seedWorkspaceModuleAccess(workspaceA.id, user.id, {
        module: 'CRM',
      })
      await seedWorkspaceModuleAccess(workspaceA.id, user.id, {
        module: 'COMMUNICATION',
      })
      await seedWorkspaceModuleAccess(workspaceB.id, user.id, {
        module: 'CRM',
      })

      const result = await WorkspaceModuleAccessRepository.listByWorkspace(
        workspaceA.id,
      )

      const list = expectOk(result)
      expect(list).toHaveLength(2)
      expect(list.every((a) => a.workspaceId === workspaceA.id)).toBe(true)
    })

    it('should return empty array when no access has been granted', async () => {
      const workspace = await seedWorkspace()

      const result = await WorkspaceModuleAccessRepository.listByWorkspace(
        workspace.id,
      )

      expect(expectOk(result)).toEqual([])
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.workspaceModuleAccess, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await WorkspaceModuleAccessRepository.listByWorkspace('ws1'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('upsert()', () => {
    it('should create a new access row', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])

      const result = await WorkspaceModuleAccessRepository.upsert(
        workspace.id,
        'CRM',
        true,
        user.id,
      )

      const access = expectOk(result)
      expect(access.module).toBe('CRM')
      expect(access.enabled).toBe(true)
      expect(access.grantedById).toBe(user.id)
    })

    it('should update the existing row for the same workspace/module pair', async () => {
      const [workspace, user, otherUser] = await Promise.all([
        seedWorkspace(),
        seedUser(),
        seedUser(),
      ])
      await seedWorkspaceModuleAccess(workspace.id, user.id, {
        module: 'CRM',
        enabled: true,
      })

      const result = await WorkspaceModuleAccessRepository.upsert(
        workspace.id,
        'CRM',
        false,
        otherUser.id,
      )

      const access = expectOk(result)
      expect(access.enabled).toBe(false)
      expect(access.grantedById).toBe(otherUser.id)

      const rows = await prisma.workspaceModuleAccess.findMany({
        where: { workspaceId: workspace.id },
      })
      expect(rows).toHaveLength(1)
    })

    it('should return DATABASE_ERROR when the workspace does not exist', async () => {
      const user = await seedUser()
      const result = await WorkspaceModuleAccessRepository.upsert(
        'nonexistent-workspace',
        'CRM',
        true,
        user.id,
      )
      expectErr(result, 'DATABASE_ERROR')
    })
  })

  describe('isEnabled()', () => {
    it('should return true when access is granted and enabled', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedWorkspaceModuleAccess(workspace.id, user.id, {
        module: 'COMMUNICATION',
        enabled: true,
      })

      const result = await WorkspaceModuleAccessRepository.isEnabled(
        workspace.id,
        'COMMUNICATION',
      )

      expect(expectOk(result)).toBe(true)
    })

    it('should return false when access was explicitly disabled', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedWorkspaceModuleAccess(workspace.id, user.id, {
        module: 'COMMUNICATION',
        enabled: false,
      })

      const result = await WorkspaceModuleAccessRepository.isEnabled(
        workspace.id,
        'COMMUNICATION',
      )

      expect(expectOk(result)).toBe(false)
    })

    it('should return false when no access row exists (opt-in default)', async () => {
      const workspace = await seedWorkspace()

      const result = await WorkspaceModuleAccessRepository.isEnabled(
        workspace.id,
        'COMMUNICATION',
      )

      expect(expectOk(result)).toBe(false)
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(
        prisma.workspaceModuleAccess,
        'findUnique',
      ).mockRejectedValueOnce(new Error('boom'))
      expectErr(
        await WorkspaceModuleAccessRepository.isEnabled('ws1', 'CRM'),
        'DATABASE_ERROR',
      )
    })
  })
})
