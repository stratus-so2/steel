import type { CrmHookVaultItem, CrmSocialPlatform } from '@prisma/client'
import { notFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export type CreateCrmHookVaultItemData = {
  workspaceId: string
  createdById: string
  text: string
  platform?: CrmSocialPlatform | null
  usageCount?: number
  notes?: string | null
}

export type UpdateCrmHookVaultItemData = {
  updatedById: string
  text?: string
  platform?: CrmSocialPlatform | null
  usageCount?: number
  notes?: string | null
}

export const CrmHookVaultRepository = {
  async listByWorkspace(
    workspaceId: string,
  ): Promise<Result<CrmHookVaultItem[]>> {
    try {
      const items = await prisma.crmHookVaultItem.findMany({
        where: { workspaceId, deletedAt: null },
        orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      })
      return ok(items)
    } catch (error) {
      return err(dbError('Failed to list CRM hook vault items', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<CrmHookVaultItem>> {
    try {
      const item = await prisma.crmHookVaultItem.findFirst({
        where: { id, workspaceId, deletedAt: null },
      })
      if (!item) return err(notFound('CrmHookVaultItem'))
      return ok(item)
    } catch (error) {
      return err(dbError('Failed to find CRM hook vault item by id', error))
    }
  },

  async create(
    data: CreateCrmHookVaultItemData,
  ): Promise<Result<CrmHookVaultItem>> {
    try {
      const item = await prisma.crmHookVaultItem.create({ data })
      return ok(item)
    } catch (error) {
      return err(dbError('Failed to create CRM hook vault item', error))
    }
  },

  async update(
    id: string,
    data: UpdateCrmHookVaultItemData,
  ): Promise<Result<CrmHookVaultItem>> {
    try {
      const item = await prisma.crmHookVaultItem.update({
        where: { id },
        data,
      })
      return ok(item)
    } catch (error) {
      return err(dbError('Failed to update CRM hook vault item', error))
    }
  },

  async softDelete(id: string, updatedById: string): Promise<Result<void>> {
    try {
      await prisma.crmHookVaultItem.update({
        where: { id },
        data: { deletedAt: new Date(), updatedById },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete CRM hook vault item', error))
    }
  },

  async reorder(
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    try {
      await prisma.$transaction(
        orderedIds.map((id, index) =>
          prisma.crmHookVaultItem.updateMany({
            where: { id, workspaceId, deletedAt: null },
            data: { position: index + 1 },
          }),
        ),
      )
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to reorder CRM hook vault items', error))
    }
  },
}
