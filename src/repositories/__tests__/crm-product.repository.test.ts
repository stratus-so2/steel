import { describe, expect, it } from 'vitest'
import { seedCrmProduct } from '@/src/__tests__/factories/crm-product.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { CrmProductRepository } from '../crm-product.repository'

describe('CrmProductRepository', () => {
  describe('create()', () => {
    it('should assign the next position within the workspace', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedCrmProduct(workspace.id, user.id)

      const result = await CrmProductRepository.create({
        workspaceId: workspace.id,
        createdById: user.id,
        name: 'Second',
      })

      const product = expectOk(result)
      expect(product.position).toBe(1)
    })

    it('should return CRM_PRODUCT_CONFLICT on duplicate sku', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedCrmProduct(workspace.id, user.id, { sku: 'PRO-1' })

      const result = await CrmProductRepository.create({
        workspaceId: workspace.id,
        createdById: user.id,
        name: 'Dup',
        sku: 'PRO-1',
      })

      expectErr(result, 'CRM_PRODUCT_CONFLICT')
    })
  })

  describe('listByWorkspace()', () => {
    it('should filter by active when provided', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const active = await seedCrmProduct(workspace.id, user.id, {
        active: true,
      })
      await seedCrmProduct(workspace.id, user.id, { active: false })

      const list = expectOk(
        await CrmProductRepository.listByWorkspace(workspace.id, {
          active: true,
        }),
      )
      expect(list.map((p) => p.id)).toEqual([active.id])
    })

    it('should exclude soft-deleted products', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const kept = await seedCrmProduct(workspace.id, user.id)
      await seedCrmProduct(workspace.id, user.id, { deletedAt: new Date() })

      const list = expectOk(
        await CrmProductRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((p) => p.id)).toEqual([kept.id])
    })
  })
})
