import type { CrmDocumentTemplate, CrmDocumentType } from '@prisma/client'
import { notFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const CrmDocumentTemplateRepository = {
  async listByWorkspace(
    workspaceId: string,
    type?: CrmDocumentType,
  ): Promise<Result<CrmDocumentTemplate[]>> {
    try {
      const templates = await prisma.crmDocumentTemplate.findMany({
        where: { workspaceId, deletedAt: null, ...(type ? { type } : {}) },
        orderBy: { createdAt: 'desc' },
      })
      return ok(templates)
    } catch (error) {
      return err(dbError('Failed to list CRM document templates', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<CrmDocumentTemplate>> {
    try {
      const template = await prisma.crmDocumentTemplate.findFirst({
        where: { id, workspaceId, deletedAt: null },
      })
      if (!template) return err(notFound('CrmDocumentTemplate'))
      return ok(template)
    } catch (error) {
      return err(dbError('Failed to find CRM document template by id', error))
    }
  },

  async create(data: {
    workspaceId: string
    createdById: string
    title: string
    content: string
    contentJson?: string
    type: CrmDocumentType
  }): Promise<Result<CrmDocumentTemplate>> {
    try {
      const template = await prisma.crmDocumentTemplate.create({ data })
      return ok(template)
    } catch (error) {
      return err(dbError('Failed to create CRM document template', error))
    }
  },

  async softDelete(id: string): Promise<Result<void>> {
    try {
      await prisma.crmDocumentTemplate.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete CRM document template', error))
    }
  },
}
