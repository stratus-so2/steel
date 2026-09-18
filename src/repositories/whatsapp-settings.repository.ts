import type { Prisma, WhatsAppSettings } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const WhatsAppSettingsRepository = {
  async findByWorkspace(
    workspaceId: string,
  ): Promise<Result<WhatsAppSettings | null>> {
    try {
      const settings = await prisma.whatsAppSettings.findUnique({
        where: { workspaceId },
      })
      return ok(settings)
    } catch (error) {
      return err(dbError('Failed to find whatsapp settings', error))
    }
  },

  /** Todas as linhas salvas (poucas: uma por workspace que mexeu nas
   * configurações) — base do fechamento automático. */
  async listAll(): Promise<Result<WhatsAppSettings[]>> {
    try {
      const rows = await prisma.whatsAppSettings.findMany()
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list whatsapp settings', error))
    }
  },

  async upsert(
    workspaceId: string,
    data: Omit<Prisma.WhatsAppSettingsUncheckedCreateInput, 'workspaceId'>,
  ): Promise<Result<WhatsAppSettings>> {
    try {
      const settings = await prisma.whatsAppSettings.upsert({
        where: { workspaceId },
        create: { workspaceId, ...data },
        update: data,
      })
      return ok(settings)
    } catch (error) {
      return err(dbError('Failed to upsert whatsapp settings', error))
    }
  },
}
