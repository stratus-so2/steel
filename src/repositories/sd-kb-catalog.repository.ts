import type { SdCategory } from '@prisma/client'
import { sdCategoryNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

/**
 * Leituras de apoio da KB em tabelas de outras fatias (categorias do catálogo
 * e membros do workspace) — só leitura, sem regras de negócio.
 */

export type SdKbCategoryRow = Pick<
  SdCategory,
  'id' | 'name' | 'icon' | 'description' | 'parentId' | 'portalVisible'
> & { articleCount: number }

export interface SdKbMemberRow {
  userId: string
  name: string
  image: string | null
}

export const SdKbCatalogRepository = {
  /** Categoria ativa do workspace (valida o `categoryId` do artigo). */
  async findCategory(
    id: string,
    workspaceId: string,
  ): Promise<Result<Pick<SdCategory, 'id' | 'name'>>> {
    try {
      const category = await prisma.sdCategory.findFirst({
        where: { id, workspaceId, active: true },
        select: { id: true, name: true },
      })
      if (!category) return err(sdCategoryNotFound())
      return ok(category)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk category', error))
    }
  },

  /**
   * Categorias ativas com a contagem de artigos vivos. `portalOnly`: só
   * categorias visíveis no portal e artigos publicados/portal.
   */
  async listCategoriesWithCounts(
    workspaceId: string,
    portalOnly: boolean,
  ): Promise<Result<SdKbCategoryRow[]>> {
    try {
      const [categories, counts] = await Promise.all([
        prisma.sdCategory.findMany({
          where: {
            workspaceId,
            active: true,
            ...(portalOnly ? { portalVisible: true } : {}),
          },
          select: {
            id: true,
            name: true,
            icon: true,
            description: true,
            parentId: true,
            portalVisible: true,
          },
          orderBy: [{ position: 'asc' }, { name: 'asc' }],
        }),
        prisma.sdKbArticle.groupBy({
          by: ['categoryId'],
          where: {
            workspaceId,
            archivedAt: null,
            categoryId: { not: null },
            ...(portalOnly
              ? { status: 'PUBLISHED' as const, visibility: 'PORTAL' as const }
              : {}),
          },
          _count: { _all: true },
        }),
      ])
      const byCategory = new Map(
        counts.map((c) => [c.categoryId, c._count._all]),
      )
      return ok(
        categories.map((c) => ({
          ...c,
          articleCount: byCategory.get(c.id) ?? 0,
        })),
      )
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk KB categories', error))
    }
  },

  /** Membros do workspace para @menção no editor (nome contém `q`). */
  async listMembers(
    workspaceId: string,
    q: string,
    take = 8,
  ): Promise<Result<SdKbMemberRow[]>> {
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
        rows.map((r) => ({
          userId: r.user.id,
          name: r.user.name,
          image: r.user.image,
        })),
      )
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk KB members', error))
    }
  },
}
