import type { Prisma, WikiPage as WikiPageRow } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { wikiPageNotFound } from '../errors'
import { err, ok, type Result } from '../lib/result'
import { dbError } from './db-error'

// Every read and write carries the page's label ids, so the DTO a mutation
// returns never drops the labels the client already has.
const WITH_LABELS = {
  labels: { select: { labelId: true } },
} satisfies Prisma.WikiPageInclude

export type WikiPage = WikiPageRow & { labels: { labelId: string }[] }

const EMPTY_CONTENT: Prisma.InputJsonValue = [
  { type: 'p', children: [{ text: '' }] },
]

export const WikiPageRepository = {
  async findById(id: string): Promise<Result<WikiPage>> {
    try {
      const wikiPage = await prisma.wikiPage.findUnique({
        where: { id },
        include: WITH_LABELS,
      })
      if (!wikiPage) return err(wikiPageNotFound())
      return ok(wikiPage)
    } catch (error) {
      return err(dbError('Failed to find wiki page by id', error))
    }
  },

  async listByWorkspace(workspaceId: string): Promise<Result<WikiPage[]>> {
    try {
      const wikiPages = await prisma.wikiPage.findMany({
        where: { workspaceId, archivedAt: null },
        orderBy: [{ parentId: 'asc' }, { position: 'asc' }],
        include: WITH_LABELS,
      })
      return ok(wikiPages)
    } catch (error) {
      return err(dbError('Failed to list wiki pages', error))
    }
  },

  async create(data: {
    workspaceId: string
    parentId: string | null
    title: string
    icon?: string
    createdById: string
  }): Promise<Result<WikiPage>> {
    try {
      const siblingCount = await prisma.wikiPage.count({
        where: {
          workspaceId: data.workspaceId,
          parentId: data.parentId,
          archivedAt: null,
        },
      })

      const wiki = await prisma.wikiPage.create({
        data: {
          workspaceId: data.workspaceId,
          parentId: data.parentId,
          title: data.title,
          icon: data.icon,
          content: EMPTY_CONTENT,
          position: siblingCount,
          createdById: data.createdById,
        },
        include: WITH_LABELS,
      })

      return ok(wiki)
    } catch (error) {
      return err(dbError('Failed to create wiki page', error))
    }
  },

  async update(
    id: string,
    data: {
      title?: string
      icon?: string | null
      coverImage?: string | null
      content?: Prisma.InputJsonValue
      updatedById: string
    },
  ): Promise<Result<WikiPage>> {
    try {
      const wikiPage = await prisma.wikiPage.update({
        where: { id },
        data,
        include: WITH_LABELS,
      })
      return ok(wikiPage)
    } catch (error) {
      return err(dbError('Failed to update wiki page', error))
    }
  },

  async move(
    id: string,
    data: { parentId: string | null; position: number; updatedById: string },
  ): Promise<Result<WikiPage>> {
    try {
      const wikiPage = await prisma.wikiPage.update({
        where: { id },
        data,
        include: WITH_LABELS,
      })
      return ok(wikiPage)
    } catch (error) {
      return err(dbError('Failed to move wiki page', error))
    }
  },

  // Archives the page and its whole subtree with one shared timestamp, so a
  // future restore can bring back exactly what went away together. Pages
  // already archived keep their own timestamp, but the walk still goes
  // through them to reach live descendants left behind by older archives.
  async archive(id: string, updatedById: string): Promise<Result<WikiPage>> {
    try {
      const archivedAt = new Date()
      const wikiPage = await prisma.$transaction(async (tx) => {
        const page = await tx.wikiPage.update({
          where: { id },
          data: { archivedAt, updatedById },
          include: WITH_LABELS,
        })

        let parentIds = [id]
        while (parentIds.length > 0) {
          const children = await tx.wikiPage.findMany({
            where: { parentId: { in: parentIds } },
            select: { id: true },
          })
          parentIds = children.map((child) => child.id)
          if (parentIds.length > 0) {
            await tx.wikiPage.updateMany({
              where: { id: { in: parentIds }, archivedAt: null },
              data: { archivedAt, updatedById },
            })
          }
        }

        return page
      })
      return ok(wikiPage)
    } catch (error) {
      return err(dbError('Failed to archive wiki page', error))
    }
  },

  async updateYjsState(
    id: string,
    data: { yjsState: Uint8Array; updatedById: string },
  ): Promise<Result<WikiPage>> {
    try {
      const wikiPage = await prisma.wikiPage.update({
        where: { id },
        // `Y.encodeStateAsUpdate()` types its result as
        // `Uint8Array<ArrayBufferLike>`, but Prisma's Bytes field wants
        // `Uint8Array<ArrayBuffer>` — copy into a plain ArrayBuffer-backed
        // array to satisfy it.
        data: { ...data, yjsState: new Uint8Array(data.yjsState) },
        include: WITH_LABELS,
      })
      return ok(wikiPage)
    } catch (error) {
      return err(dbError('Failed to persist wiki page yjs state', error))
    }
  },

  /** Workspace members for the editor's @mention, by name. */
  async listMembers(
    workspaceId: string,
    q: string,
    take = 8,
  ): Promise<Result<{ userId: string; name: string; image: string | null }[]>> {
    try {
      const rows = await prisma.membership.findMany({
        where: {
          workspaceId,
          ...(q
            ? { user: { name: { contains: q, mode: 'insensitive' } } }
            : {}),
        },
        select: { user: { select: { id: true, name: true, image: true } } },
        orderBy: { user: { name: 'asc' } },
        take,
      })
      return ok(
        rows.map((row) => ({
          userId: row.user.id,
          name: row.user.name,
          image: row.user.image,
        })),
      )
    } catch (error) {
      return err(dbError('Failed to list wiki mentionable members', error))
    }
  },
}
