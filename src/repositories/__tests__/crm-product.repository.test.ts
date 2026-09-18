import { describe, expect, it, vi } from 'vitest'
import { seedCrmProduct } from '@/src/__tests__/factories/crm-product.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
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

  describe('create() / generic failures', () => {
    it('should return DATABASE_ERROR when the workspace does not exist', async () => {
      const user = await seedUser()
      expectErr(
        await CrmProductRepository.create({
          workspaceId: 'missing-workspace',
          createdById: user.id,
          name: 'Orphan',
        }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('listByWorkspace() / ordering & scoping', () => {
    it('should order by position and never leak other workspaces', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const second = await seedCrmProduct(workspace.id, user.id, {
        position: 2,
      })
      const first = await seedCrmProduct(workspace.id, user.id, {
        position: 1,
      })
      await seedCrmProduct(other.id, user.id)

      const list = expectOk(
        await CrmProductRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((p) => p.id)).toEqual([first.id, second.id])
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmProduct, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await CrmProductRepository.listByWorkspace('ws'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('findById()', () => {
    it('should find a live product in its workspace only', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const product = await seedCrmProduct(workspace.id, user.id)
      const deleted = await seedCrmProduct(workspace.id, user.id, {
        deletedAt: new Date(),
      })

      expect(
        expectOk(await CrmProductRepository.findById(product.id, workspace.id))
          .id,
      ).toBe(product.id)
      expectErr(
        await CrmProductRepository.findById(product.id, other.id),
        'RESOURCE_NOT_FOUND',
      )
      expectErr(
        await CrmProductRepository.findById(deleted.id, workspace.id),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmProduct, 'findFirst').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await CrmProductRepository.findById('p', 'ws'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('update()', () => {
    it('should update the product fields', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const product = await seedCrmProduct(workspace.id, user.id)

      const updated = expectOk(
        await CrmProductRepository.update(product.id, {
          name: 'Renamed',
          unitPrice: 42.5,
          active: false,
          updatedById: user.id,
        }),
      )
      expect(updated.name).toBe('Renamed')
      expect(Number(updated.unitPrice)).toBe(42.5)
      expect(updated.active).toBe(false)
    })

    it('should return CRM_PRODUCT_CONFLICT when the sku is taken', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedCrmProduct(workspace.id, user.id, { sku: 'TAKEN' })
      const product = await seedCrmProduct(workspace.id, user.id, {
        sku: 'FREE',
      })

      expectErr(
        await CrmProductRepository.update(product.id, { sku: 'TAKEN' }),
        'CRM_PRODUCT_CONFLICT',
      )
    })

    it('should return DATABASE_ERROR for a missing product', async () => {
      expectErr(
        await CrmProductRepository.update('missing', { name: 'x' }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('softDelete()', () => {
    it('should hide the product from reads', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const product = await seedCrmProduct(workspace.id, user.id)

      expectOk(await CrmProductRepository.softDelete(product.id))
      expectErr(
        await CrmProductRepository.findById(product.id, workspace.id),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should return DATABASE_ERROR for a missing product', async () => {
      expectErr(
        await CrmProductRepository.softDelete('missing'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('reorder()', () => {
    it('should rewrite positions following the given order', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const a = await seedCrmProduct(workspace.id, user.id, { position: 0 })
      const b = await seedCrmProduct(workspace.id, user.id, { position: 1 })

      expectOk(await CrmProductRepository.reorder(workspace.id, [b.id, a.id]))

      const list = expectOk(
        await CrmProductRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((p) => p.id)).toEqual([b.id, a.id])
    })

    it('should return DATABASE_ERROR when an id belongs to another workspace', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const foreign = await seedCrmProduct(other.id, user.id)

      expectErr(
        await CrmProductRepository.reorder(workspace.id, [foreign.id]),
        'DATABASE_ERROR',
      )
    })
  })
})
