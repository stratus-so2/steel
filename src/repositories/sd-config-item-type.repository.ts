import type { Prisma } from '@prisma/client'
import { sdConfigItemTypeNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

const typeInclude = {
  _count: { select: { items: { where: { deletedAt: null } } } },
} satisfies Prisma.SdConfigItemTypeInclude

export type SdConfigItemTypeRow = Prisma.SdConfigItemTypeGetPayload<{
  include: typeof typeInclude
}>

export interface SdConfigItemTypeWriteData {
  name?: string
  icon?: string | null
  color?: string | null
  attributeSchema?: Prisma.InputJsonValue
  position?: number
}

export const SdConfigItemTypeRepository = {
  async list(workspaceId: string): Promise<Result<SdConfigItemTypeRow[]>> {
    try {
      const types = await prisma.sdConfigItemType.findMany({
        where: { workspaceId },
        include: typeInclude,
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
      })
      return ok(types)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk CI types', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<SdConfigItemTypeRow>> {
    try {
      const type = await prisma.sdConfigItemType.findFirst({
        where: { id, workspaceId },
        include: typeInclude,
      })
      if (!type) return err(sdConfigItemTypeNotFound())
      return ok(type)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk CI type', error))
    }
  },

  /** Outro tipo com o mesmo nome (sem diferenciar maiúsculas)? */
  async nameTaken(
    workspaceId: string,
    name: string,
    excludeId?: string,
  ): Promise<Result<boolean>> {
    try {
      const found = await prisma.sdConfigItemType.findFirst({
        where: {
          workspaceId,
          name: { equals: name, mode: 'insensitive' },
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
      })
      return ok(found !== null)
    } catch (error) {
      return err(dbError('Failed to check ServiceDesk CI type name', error))
    }
  },

  async create(
    data: SdConfigItemTypeWriteData & { workspaceId: string; name: string },
  ): Promise<Result<SdConfigItemTypeRow>> {
    try {
      const position =
        data.position ??
        (await prisma.sdConfigItemType.count({
          where: { workspaceId: data.workspaceId },
        }))
      const type = await prisma.sdConfigItemType.create({
        data: { ...data, position },
        include: typeInclude,
      })
      return ok(type)
    } catch (error) {
      return err(dbError('Failed to create ServiceDesk CI type', error))
    }
  },

  async update(
    id: string,
    data: SdConfigItemTypeWriteData,
  ): Promise<Result<SdConfigItemTypeRow>> {
    try {
      const type = await prisma.sdConfigItemType.update({
        where: { id },
        data,
        include: typeInclude,
      })
      return ok(type)
    } catch (error) {
      return err(dbError('Failed to update ServiceDesk CI type', error))
    }
  },

  /** Exclusão física; os CIs do tipo ficam sem tipo (`SetNull`). */
  async delete(id: string): Promise<Result<void>> {
    try {
      await prisma.sdConfigItemType.delete({ where: { id } })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete ServiceDesk CI type', error))
    }
  },
}
