import type { Prisma, WhatsAppAiConfig } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const WhatsAppAiConfigRepository = {
  async findByWorkspace(
    workspaceId: string,
  ): Promise<Result<WhatsAppAiConfig | null>> {
    try {
      const config = await prisma.whatsAppAiConfig.findUnique({
        where: { workspaceId },
      })
      return ok(config)
    } catch (error) {
      return err(dbError('Failed to find whatsapp ai config', error))
    }
  },

  async upsert(
    workspaceId: string,
    data: Omit<Prisma.WhatsAppAiConfigUncheckedCreateInput, 'workspaceId'>,
  ): Promise<Result<WhatsAppAiConfig>> {
    try {
      const config = await prisma.whatsAppAiConfig.upsert({
        where: { workspaceId },
        create: { workspaceId, ...data },
        update: data,
      })
      return ok(config)
    } catch (error) {
      return err(dbError('Failed to upsert whatsapp ai config', error))
    }
  },
}
