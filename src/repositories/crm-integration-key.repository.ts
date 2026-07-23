import type { CrmIntegrationApiKey } from '@prisma/client'
import { notFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const CrmIntegrationKeyRepository = {
  async listByWorkspace(
    workspaceId: string,
  ): Promise<Result<CrmIntegrationApiKey[]>> {
    try {
      const keys = await prisma.crmIntegrationApiKey.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
      })
      return ok(keys)
    } catch (error) {
      return err(dbError('Failed to list CRM integration keys', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<CrmIntegrationApiKey>> {
    try {
      const key = await prisma.crmIntegrationApiKey.findFirst({
        where: { id, workspaceId },
      })
      if (!key) return err(notFound('CrmIntegrationApiKey'))
      return ok(key)
    } catch (error) {
      return err(dbError('Failed to find CRM integration key by id', error))
    }
  },

  async findActiveByHash(
    keyHash: string,
  ): Promise<Result<CrmIntegrationApiKey | null>> {
    try {
      const key = await prisma.crmIntegrationApiKey.findFirst({
        where: { keyHash, revokedAt: null },
      })
      return ok(key)
    } catch (error) {
      return err(dbError('Failed to find CRM integration key by hash', error))
    }
  },

  async create(data: {
    workspaceId: string
    createdById: string
    name: string
    keyHash: string
    prefix: string
  }): Promise<Result<CrmIntegrationApiKey>> {
    try {
      const key = await prisma.crmIntegrationApiKey.create({ data })
      return ok(key)
    } catch (error) {
      return err(dbError('Failed to create CRM integration key', error))
    }
  },

  async markUsed(id: string): Promise<Result<void>> {
    try {
      await prisma.crmIntegrationApiKey.update({
        where: { id },
        data: { lastUsedAt: new Date() },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to mark CRM integration key as used', error))
    }
  },

  async revoke(id: string): Promise<Result<void>> {
    try {
      await prisma.crmIntegrationApiKey.update({
        where: { id },
        data: { revokedAt: new Date() },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to revoke CRM integration key', error))
    }
  },
}
