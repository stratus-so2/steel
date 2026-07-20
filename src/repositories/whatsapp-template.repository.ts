import type { Prisma, WhatsAppTemplate } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const WhatsAppTemplateRepository = {
  async listByWorkspace(
    workspaceId: string,
  ): Promise<Result<WhatsAppTemplate[]>> {
    try {
      const templates = await prisma.whatsAppTemplate.findMany({
        where: { workspaceId },
        orderBy: { name: 'asc' },
      })
      return ok(templates)
    } catch (error) {
      return err(dbError('Failed to list whatsapp templates', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<WhatsAppTemplate | null>> {
    try {
      const template = await prisma.whatsAppTemplate.findFirst({
        where: { id, workspaceId },
      })
      return ok(template)
    } catch (error) {
      return err(dbError('Failed to find whatsapp template', error))
    }
  },

  async findByConnectionAndName(
    connectionId: string,
    name: string,
    language: string,
  ): Promise<Result<WhatsAppTemplate | null>> {
    try {
      const template = await prisma.whatsAppTemplate.findUnique({
        where: { connectionId_name_language: { connectionId, name, language } },
      })
      return ok(template)
    } catch (error) {
      return err(dbError('Failed to find whatsapp template', error))
    }
  },

  async upsertSynced(data: {
    workspaceId: string
    connectionId: string
    name: string
    language: string
    category: string
    status: WhatsAppTemplate['status']
    components: Prisma.InputJsonValue
  }): Promise<Result<WhatsAppTemplate>> {
    try {
      const template = await prisma.whatsAppTemplate.upsert({
        where: {
          connectionId_name_language: {
            connectionId: data.connectionId,
            name: data.name,
            language: data.language,
          },
        },
        create: data,
        update: {
          category: data.category,
          status: data.status,
          components: data.components,
        },
      })
      return ok(template)
    } catch (error) {
      return err(dbError('Failed to upsert whatsapp template', error))
    }
  },
}
