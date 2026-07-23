import type { CrmEmailTemplate } from '@prisma/client'
import { notFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const CrmEmailTemplateRepository = {
  async listByWorkspace(
    workspaceId: string,
  ): Promise<Result<CrmEmailTemplate[]>> {
    try {
      const templates = await prisma.crmEmailTemplate.findMany({
        where: { workspaceId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      })
      return ok(templates)
    } catch (error) {
      return err(dbError('Failed to list CRM email templates', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<CrmEmailTemplate>> {
    try {
      const template = await prisma.crmEmailTemplate.findFirst({
        where: { id, workspaceId, deletedAt: null },
      })
      if (!template) return err(notFound('CrmEmailTemplate'))
      return ok(template)
    } catch (error) {
      return err(dbError('Failed to find CRM email template by id', error))
    }
  },

  async create(data: {
    workspaceId: string
    createdById: string
    name: string
    subject: string
    contentHtml: string
    contentJson?: string
  }): Promise<Result<CrmEmailTemplate>> {
    try {
      const template = await prisma.crmEmailTemplate.create({ data })
      return ok(template)
    } catch (error) {
      return err(dbError('Failed to create CRM email template', error))
    }
  },

  async update(
    id: string,
    data: {
      name?: string
      subject?: string
      contentHtml?: string
      contentJson?: string
      updatedById?: string
    },
  ): Promise<Result<CrmEmailTemplate>> {
    try {
      const template = await prisma.crmEmailTemplate.update({
        where: { id },
        data,
      })
      return ok(template)
    } catch (error) {
      return err(dbError('Failed to update CRM email template', error))
    }
  },

  async softDelete(id: string): Promise<Result<void>> {
    try {
      await prisma.crmEmailTemplate.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete CRM email template', error))
    }
  },
}
