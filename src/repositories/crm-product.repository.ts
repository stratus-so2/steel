import type { CrmBillingType, CrmProduct } from '@prisma/client'
import { crmProductConflict, notFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const CrmProductRepository = {
  async listByWorkspace(
    workspaceId: string,
    filters?: { active?: boolean },
  ): Promise<Result<CrmProduct[]>> {
    try {
      const products = await prisma.crmProduct.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          ...(filters?.active !== undefined ? { active: filters.active } : {}),
        },
        orderBy: { position: 'asc' },
      })
      return ok(products)
    } catch (error) {
      return err(dbError('Failed to list CRM products', error))
    }
  },

  async findById(id: string, workspaceId: string): Promise<Result<CrmProduct>> {
    try {
      const product = await prisma.crmProduct.findFirst({
        where: { id, workspaceId, deletedAt: null },
      })
      if (!product) return err(notFound('CrmProduct'))
      return ok(product)
    } catch (error) {
      return err(dbError('Failed to find CRM product by id', error))
    }
  },

  async create(data: {
    workspaceId: string
    createdById: string
    name: string
    sku?: string
    description?: string
    unitPrice?: number
    currency?: string
    billingType?: CrmBillingType
    active?: boolean
  }): Promise<Result<CrmProduct>> {
    try {
      const position = await prisma.crmProduct.count({
        where: { workspaceId: data.workspaceId, deletedAt: null },
      })
      const product = await prisma.crmProduct.create({
        data: { ...data, position },
      })
      return ok(product)
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        return err(crmProductConflict())
      }
      return err(dbError('Failed to create CRM product', error))
    }
  },

  async update(
    id: string,
    data: {
      name?: string
      sku?: string
      description?: string
      unitPrice?: number
      currency?: string
      billingType?: CrmBillingType
      active?: boolean
      updatedById?: string
    },
  ): Promise<Result<CrmProduct>> {
    try {
      const product = await prisma.crmProduct.update({ where: { id }, data })
      return ok(product)
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        return err(crmProductConflict())
      }
      return err(dbError('Failed to update CRM product', error))
    }
  },

  async softDelete(id: string): Promise<Result<void>> {
    try {
      await prisma.crmProduct.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete CRM product', error))
    }
  },

  async reorder(
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    try {
      await prisma.$transaction(
        orderedIds.map((id, position) =>
          prisma.crmProduct.update({
            where: { id, workspaceId },
            data: { position },
          }),
        ),
      )
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to reorder CRM products', error))
    }
  },
}
