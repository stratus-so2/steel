import { describe, expect, it } from 'vitest'
import { seedCrmHookVaultItem } from '@/src/__tests__/factories/crm-hook-vault.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
import { CrmHookVaultRepository } from '../crm-hook-vault.repository'

describe('CrmHookVaultRepository', () => {
  describe('listByWorkspace()', () => {
    it('should exclude soft-deleted items', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const kept = await seedCrmHookVaultItem(workspace.id, user.id)
      await seedCrmHookVaultItem(workspace.id, user.id, {
        deletedAt: new Date(),
      })

      const list = expectOk(
        await CrmHookVaultRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((i) => i.id)).toEqual([kept.id])
    })
  })

  describe('reorder()', () => {
    it('should update positions across the workspace', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const a = await seedCrmHookVaultItem(workspace.id, user.id)
      const b = await seedCrmHookVaultItem(workspace.id, user.id)

      expectOk(await CrmHookVaultRepository.reorder(workspace.id, [b.id, a.id]))

      const list = expectOk(
        await CrmHookVaultRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((i) => i.id)).toEqual([b.id, a.id])
    })
  })

  describe('softDelete()', () => {
    it('should stamp deletedAt and updatedById', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const item = await seedCrmHookVaultItem(workspace.id, user.id)

      expectOk(await CrmHookVaultRepository.softDelete(item.id, user.id))

      const found = await CrmHookVaultRepository.findById(item.id, workspace.id)
      expect(found.ok).toBe(false)
    })
  })
})
