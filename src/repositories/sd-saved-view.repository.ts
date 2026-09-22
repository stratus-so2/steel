import type { Prisma, SdSavedView } from '@prisma/client'
import { notFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const SdSavedViewRepository = {
  /** Visões próprias + compartilhadas do workspace. */
  async listVisible(
    workspaceId: string,
    userId: string,
  ): Promise<Result<SdSavedView[]>> {
    try {
      const rows = await prisma.sdSavedView.findMany({
        where: { workspaceId, OR: [{ userId }, { shared: true }] },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk saved views', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<SdSavedView>> {
    try {
      const row = await prisma.sdSavedView.findFirst({
        where: { id, workspaceId },
      })
      if (!row) return err(notFound('Visão salva'))
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk saved view', error))
    }
  },

  async create(
    data: Prisma.SdSavedViewUncheckedCreateInput,
  ): Promise<Result<SdSavedView>> {
    try {
      const position =
        data.position ??
        (await prisma.sdSavedView.count({
          where: { workspaceId: data.workspaceId, userId: data.userId },
        }))
      const row = await prisma.sdSavedView.create({
        data: { ...data, position },
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to create ServiceDesk saved view', error))
    }
  },

  async update(
    id: string,
    data: Prisma.SdSavedViewUncheckedUpdateInput,
  ): Promise<Result<SdSavedView>> {
    try {
      return ok(await prisma.sdSavedView.update({ where: { id }, data }))
    } catch (error) {
      return err(dbError('Failed to update ServiceDesk saved view', error))
    }
  },

  async delete(id: string): Promise<Result<void>> {
    try {
      await prisma.sdSavedView.delete({ where: { id } })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete ServiceDesk saved view', error))
    }
  },
}
