import type { WikiLabel } from '@prisma/client'
import { wikiLabelConflict, wikiLabelNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'P2002'
}

export const WikiLabelRepository = {
  async findById(id: string): Promise<Result<WikiLabel>> {
    try {
      const label = await prisma.wikiLabel.findUnique({ where: { id } })
      if (!label) return err(wikiLabelNotFound())
      return ok(label)
    } catch (error) {
      return err(dbError('Failed to find wiki label by id', error))
    }
  },

  async listByWorkspace(
    workspaceId: string,
  ): Promise<Result<(WikiLabel & { pageCount: number })[]>> {
    try {
      const labels = await prisma.wikiLabel.findMany({
        where: { workspaceId },
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { pages: { where: { wikiPage: { archivedAt: null } } } },
          },
        },
      })
      return ok(
        labels.map(({ _count, ...label }) => ({
          ...label,
          pageCount: _count.pages,
        })),
      )
    } catch (error) {
      return err(dbError('Failed to list wiki labels', error))
    }
  },

  /** How many of `ids` are labels of this workspace (guards page labeling). */
  async countInWorkspace(
    workspaceId: string,
    ids: string[],
  ): Promise<Result<number>> {
    try {
      const count = await prisma.wikiLabel.count({
        where: { workspaceId, id: { in: ids } },
      })
      return ok(count)
    } catch (error) {
      return err(dbError('Failed to count wiki labels', error))
    }
  },

  async create(data: {
    workspaceId: string
    name: string
    color: string
  }): Promise<Result<WikiLabel>> {
    try {
      const label = await prisma.wikiLabel.create({ data })
      return ok(label)
    } catch (error) {
      if (isUniqueViolation(error)) return err(wikiLabelConflict())
      return err(dbError('Failed to create wiki label', error))
    }
  },

  async update(
    id: string,
    data: { name?: string; color?: string },
  ): Promise<Result<WikiLabel>> {
    try {
      const label = await prisma.wikiLabel.update({ where: { id }, data })
      return ok(label)
    } catch (error) {
      if (isUniqueViolation(error)) return err(wikiLabelConflict())
      return err(dbError('Failed to update wiki label', error))
    }
  },

  async delete(id: string): Promise<Result<void>> {
    try {
      await prisma.wikiLabel.delete({ where: { id } })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete wiki label', error))
    }
  },

  /** Replaces the whole label set of a page. */
  async setPageLabels(
    wikiPageId: string,
    labelIds: string[],
  ): Promise<Result<void>> {
    try {
      await prisma.$transaction([
        prisma.wikiPageLabel.deleteMany({ where: { wikiPageId } }),
        prisma.wikiPageLabel.createMany({
          data: labelIds.map((labelId) => ({ wikiPageId, labelId })),
        }),
      ])
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to set wiki page labels', error))
    }
  },
}
