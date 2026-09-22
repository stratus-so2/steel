import {
  Prisma,
  type SdKbArticle,
  type SdKbArticleStatus,
  type SdKbVisibility,
} from '@prisma/client'
import { sdKbArticleNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

const EMPTY_CONTENT: Prisma.InputJsonValue = [
  { type: 'p', children: [{ text: '' }] },
]

/** Profundidade máxima percorrida ao subir a árvore (defesa contra ciclos). */
const MAX_TREE_DEPTH = 100

const userRef = { select: { id: true, name: true, image: true } } as const
const categoryRef = { select: { id: true, name: true, icon: true } } as const

export const SD_KB_ARTICLE_INCLUDE = {
  createdBy: userRef,
  updatedBy: userRef,
  category: categoryRef,
} as const

export type SdKbArticleWithRefs = Prisma.SdKbArticleGetPayload<{
  include: typeof SD_KB_ARTICLE_INCLUDE
}>

/** Colunas da árvore/listas: tudo menos `content` e `plainText`. */
export const SD_KB_SUMMARY_SELECT = {
  id: true,
  workspaceId: true,
  parentId: true,
  title: true,
  icon: true,
  coverImage: true,
  status: true,
  visibility: true,
  categoryId: true,
  tags: true,
  position: true,
  viewCount: true,
  helpfulCount: true,
  notHelpfulCount: true,
  publishedAt: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.SdKbArticleSelect

export type SdKbArticleSummary = Prisma.SdKbArticleGetPayload<{
  select: typeof SD_KB_SUMMARY_SELECT
}>

export type SdKbSearchRow = SdKbArticleSummary & {
  plainText: string
  rank: number
}

export interface SdKbAudienceFilter {
  /** Solicitante: só PUBLISHED + PORTAL. */
  portalOnly: boolean
}

export interface SdKbSearchFilters extends SdKbAudienceFilter {
  q: string
  status?: SdKbArticleStatus
  visibility?: SdKbVisibility
  categoryId?: string
  tag?: string
  limit: number
}

function audienceWhere({
  portalOnly,
}: SdKbAudienceFilter): Prisma.SdKbArticleWhereInput {
  return portalOnly ? { status: 'PUBLISHED', visibility: 'PORTAL' } : {}
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

export const SdKbArticleRepository = {
  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<SdKbArticleWithRefs>> {
    try {
      const article = await prisma.sdKbArticle.findFirst({
        where: { id, workspaceId },
        include: SD_KB_ARTICLE_INCLUDE,
      })
      if (!article) return err(sdKbArticleNotFound())
      return ok(article)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk KB article', error))
    }
  },

  /** Árvore viva (ou a lixeira, com `archived`), ordenada por pai/posição. */
  async listByWorkspace(
    workspaceId: string,
    filters: SdKbAudienceFilter & { archived: boolean },
  ): Promise<Result<SdKbArticleSummary[]>> {
    try {
      const rows = await prisma.sdKbArticle.findMany({
        where: {
          workspaceId,
          archivedAt: filters.archived ? { not: null } : null,
          ...audienceWhere(filters),
        },
        select: SD_KB_SUMMARY_SELECT,
        orderBy: filters.archived
          ? [{ archivedAt: 'desc' }, { position: 'asc' }]
          : [{ parentId: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }],
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk KB articles', error))
    }
  },

  async create(data: {
    workspaceId: string
    parentId: string | null
    title: string
    icon?: string
    categoryId?: string
    visibility?: SdKbVisibility
    tags?: string[]
    createdById: string
  }): Promise<Result<SdKbArticleWithRefs>> {
    try {
      const siblingCount = await prisma.sdKbArticle.count({
        where: {
          workspaceId: data.workspaceId,
          parentId: data.parentId,
          archivedAt: null,
        },
      })
      const article = await prisma.sdKbArticle.create({
        data: {
          workspaceId: data.workspaceId,
          parentId: data.parentId,
          title: data.title,
          icon: data.icon,
          categoryId: data.categoryId,
          visibility: data.visibility,
          tags: data.tags,
          content: EMPTY_CONTENT,
          position: siblingCount,
          createdById: data.createdById,
          updatedById: data.createdById,
        },
        include: SD_KB_ARTICLE_INCLUDE,
      })
      return ok(article)
    } catch (error) {
      return err(dbError('Failed to create ServiceDesk KB article', error))
    }
  },

  async update(
    id: string,
    data: {
      title?: string
      icon?: string | null
      coverImage?: string | null
      content?: Prisma.InputJsonValue
      plainText?: string
      categoryId?: string | null
      visibility?: SdKbVisibility
      tags?: string[]
      updatedById: string
    },
  ): Promise<Result<SdKbArticleWithRefs>> {
    try {
      const article = await prisma.sdKbArticle.update({
        where: { id },
        data,
        include: SD_KB_ARTICLE_INCLUDE,
      })
      return ok(article)
    } catch (error) {
      return err(dbError('Failed to update ServiceDesk KB article', error))
    }
  },

  /** Rascunho ↔ publicado. Publicar carimba `publishedAt` (a cada publicação). */
  async setStatus(
    id: string,
    status: SdKbArticleStatus,
    updatedById: string,
  ): Promise<Result<SdKbArticleWithRefs>> {
    try {
      const article = await prisma.sdKbArticle.update({
        where: { id },
        data: {
          status,
          updatedById,
          ...(status === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
        },
        include: SD_KB_ARTICLE_INCLUDE,
      })
      return ok(article)
    } catch (error) {
      return err(dbError('Failed to set ServiceDesk KB article status', error))
    }
  },

  /**
   * IDs dos ancestrais de `id` (do pai até a raiz). O service usa para barrar
   * mover um artigo para dentro de um descendente dele.
   */
  async listAncestorIds(
    id: string,
    workspaceId: string,
  ): Promise<Result<string[]>> {
    try {
      const ancestors: string[] = []
      let current: string | null = id
      for (let depth = 0; current && depth < MAX_TREE_DEPTH; depth++) {
        const row: { parentId: string | null } | null =
          await prisma.sdKbArticle.findFirst({
            where: { id: current, workspaceId },
            select: { parentId: true },
          })
        current = row?.parentId ?? null
        if (current) ancestors.push(current)
      }
      return ok(ancestors)
    } catch (error) {
      return err(dbError('Failed to walk ServiceDesk KB article tree', error))
    }
  },

  /**
   * Move para `parentId` na posição `position` entre os irmãos vivos e
   * renumera os irmãos (0..n) numa transação — a ordem fica densa e estável.
   */
  async move(
    id: string,
    workspaceId: string,
    data: { parentId: string | null; position: number; updatedById: string },
  ): Promise<Result<SdKbArticleWithRefs>> {
    try {
      const article = await prisma.$transaction(async (tx) => {
        const siblings = await tx.sdKbArticle.findMany({
          where: {
            workspaceId,
            parentId: data.parentId,
            archivedAt: null,
            id: { not: id },
          },
          select: { id: true },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        })
        const ordered = siblings.map((s) => s.id)
        ordered.splice(Math.min(data.position, ordered.length), 0, id)
        for (const [index, siblingId] of ordered.entries()) {
          if (siblingId === id) continue
          await tx.sdKbArticle.update({
            where: { id: siblingId },
            data: { position: index },
          })
        }
        return tx.sdKbArticle.update({
          where: { id },
          data: {
            parentId: data.parentId,
            position: ordered.indexOf(id),
            updatedById: data.updatedById,
          },
          include: SD_KB_ARTICLE_INCLUDE,
        })
      })
      return ok(article)
    } catch (error) {
      return err(dbError('Failed to move ServiceDesk KB article', error))
    }
  },

  /**
   * Arquiva o artigo e toda a subárvore com o mesmo carimbo, para que a
   * restauração traga de volta exatamente o que saiu junto (como na Wiki).
   */
  async archive(
    id: string,
    updatedById: string,
  ): Promise<Result<SdKbArticleWithRefs>> {
    try {
      const archivedAt = new Date()
      const article = await prisma.$transaction(async (tx) => {
        const root = await tx.sdKbArticle.update({
          where: { id },
          data: { archivedAt, updatedById },
          include: SD_KB_ARTICLE_INCLUDE,
        })
        let parentIds = [id]
        while (parentIds.length > 0) {
          const children = await tx.sdKbArticle.findMany({
            where: { parentId: { in: parentIds } },
            select: { id: true },
          })
          parentIds = children.map((c) => c.id)
          if (parentIds.length > 0) {
            await tx.sdKbArticle.updateMany({
              where: { id: { in: parentIds }, archivedAt: null },
              data: { archivedAt, updatedById },
            })
          }
        }
        return root
      })
      return ok(article)
    } catch (error) {
      return err(dbError('Failed to archive ServiceDesk KB article', error))
    }
  },

  /**
   * Restaura o artigo e os descendentes arquivados junto com ele (mesmo
   * carimbo). Se o pai continua arquivado, o artigo volta para a raiz.
   */
  async restore(
    id: string,
    updatedById: string,
  ): Promise<Result<SdKbArticleWithRefs>> {
    try {
      const article = await prisma.$transaction(async (tx) => {
        const current = await tx.sdKbArticle.findUniqueOrThrow({
          where: { id },
          select: {
            archivedAt: true,
            workspaceId: true,
            parent: { select: { archivedAt: true } },
          },
        })
        const stamp = current.archivedAt
        const detach = current.parent?.archivedAt != null
        const siblingCount = detach
          ? await tx.sdKbArticle.count({
              where: {
                workspaceId: current.workspaceId,
                parentId: null,
                archivedAt: null,
              },
            })
          : 0
        const root = await tx.sdKbArticle.update({
          where: { id },
          data: {
            archivedAt: null,
            updatedById,
            ...(detach ? { parentId: null, position: siblingCount } : {}),
          },
          include: SD_KB_ARTICLE_INCLUDE,
        })
        let parentIds = [id]
        while (stamp && parentIds.length > 0) {
          const children = await tx.sdKbArticle.findMany({
            where: { parentId: { in: parentIds }, archivedAt: stamp },
            select: { id: true },
          })
          parentIds = children.map((c) => c.id)
          if (parentIds.length > 0) {
            await tx.sdKbArticle.updateMany({
              where: { id: { in: parentIds } },
              data: { archivedAt: null, updatedById },
            })
          }
        }
        return root
      })
      return ok(article)
    } catch (error) {
      return err(dbError('Failed to restore ServiceDesk KB article', error))
    }
  },

  /** O artigo e todos os descendentes (vivos ou arquivados). */
  async listSubtreeIds(id: string): Promise<Result<string[]>> {
    try {
      const ids = [id]
      let parentIds = [id]
      for (
        let depth = 0;
        parentIds.length > 0 && depth < MAX_TREE_DEPTH;
        depth++
      ) {
        const children = await prisma.sdKbArticle.findMany({
          where: { parentId: { in: parentIds } },
          select: { id: true },
        })
        parentIds = children.map((c) => c.id)
        ids.push(...parentIds)
      }
      return ok(ids)
    } catch (error) {
      return err(
        dbError('Failed to list ServiceDesk KB article subtree', error),
      )
    }
  },

  /** Exclusão definitiva (a FK apaga subárvore, comentários e vínculos). */
  async delete(id: string): Promise<Result<void>> {
    try {
      await prisma.sdKbArticle.delete({ where: { id } })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete ServiceDesk KB article', error))
    }
  },

  async incrementViews(id: string): Promise<Result<number>> {
    try {
      const row = await prisma.sdKbArticle.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
        select: { viewCount: true },
      })
      return ok(row.viewCount)
    } catch (error) {
      return err(dbError('Failed to count ServiceDesk KB article view', error))
    }
  },

  /** Aplica a variação dos contadores de voto (nunca abaixo de zero). */
  async applyVoteDelta(
    id: string,
    delta: { helpful: number; notHelpful: number },
  ): Promise<Result<{ helpfulCount: number; notHelpfulCount: number }>> {
    try {
      const rows = await prisma.$queryRaw<
        { helpfulCount: number; notHelpfulCount: number }[]
      >`
        UPDATE sd_kb_articles
        SET helpful_count = GREATEST(helpful_count + ${delta.helpful}::int, 0),
            not_helpful_count = GREATEST(not_helpful_count + ${delta.notHelpful}::int, 0)
        WHERE id = ${id}
        RETURNING helpful_count AS "helpfulCount", not_helpful_count AS "notHelpfulCount"
      `
      const row = rows[0]
      if (!row) return err(sdKbArticleNotFound())
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to vote on ServiceDesk KB article', error))
    }
  },

  /**
   * Busca por relevância: `to_tsvector('portuguese', título + texto)` com
   * peso maior no título, somado a um bônus quando o termo aparece no título
   * (ILIKE, que também cobre prefixos que o stemmer não pega). Sem termo,
   * ordena pelos atualizados mais recentemente.
   */
  async search(
    workspaceId: string,
    filters: SdKbSearchFilters,
  ): Promise<Result<SdKbSearchRow[]>> {
    try {
      const q = filters.q.trim()
      const like = `%${escapeLike(q)}%`
      const conditions: Prisma.Sql[] = [
        Prisma.sql`workspace_id = ${workspaceId}`,
        Prisma.sql`archived_at IS NULL`,
      ]
      if (filters.portalOnly) {
        conditions.push(
          Prisma.sql`status = 'PUBLISHED'::"SdKbArticleStatus"`,
          Prisma.sql`visibility = 'PORTAL'::"SdKbVisibility"`,
        )
      }
      if (filters.status) {
        conditions.push(
          Prisma.sql`status = ${filters.status}::"SdKbArticleStatus"`,
        )
      }
      if (filters.visibility) {
        conditions.push(
          Prisma.sql`visibility = ${filters.visibility}::"SdKbVisibility"`,
        )
      }
      if (filters.categoryId) {
        conditions.push(Prisma.sql`category_id = ${filters.categoryId}`)
      }
      if (filters.tag) {
        conditions.push(Prisma.sql`${filters.tag} = ANY(tags)`)
      }
      const vector = Prisma.sql`(setweight(to_tsvector('portuguese', coalesce(title, '')), 'A') || setweight(to_tsvector('portuguese', coalesce(plain_text, '')), 'B'))`
      const query = Prisma.sql`plainto_tsquery('portuguese', ${q})`
      if (q) {
        conditions.push(
          Prisma.sql`(${vector} @@ ${query} OR title ILIKE ${like} OR plain_text ILIKE ${like})`,
        )
      }
      const rank = q
        ? Prisma.sql`(ts_rank(${vector}, ${query}) + CASE WHEN title ILIKE ${like} THEN 1 ELSE 0 END)`
        : Prisma.sql`0`
      const hits = await prisma.$queryRaw<{ id: string; rank: number }[]>`
        SELECT id, ${rank}::float8 AS rank
        FROM sd_kb_articles
        WHERE ${Prisma.join(conditions, ' AND ')}
        ORDER BY rank DESC, updated_at DESC
        LIMIT ${filters.limit}
      `
      if (hits.length === 0) return ok([])
      const rows = await prisma.sdKbArticle.findMany({
        where: { id: { in: hits.map((h) => h.id) } },
        select: { ...SD_KB_SUMMARY_SELECT, plainText: true },
      })
      const byId = new Map(rows.map((r) => [r.id, r]))
      return ok(
        hits.flatMap((hit) => {
          const row = byId.get(hit.id)
          return row ? [{ ...row, rank: Number(hit.rank) }] : []
        }),
      )
    } catch (error) {
      return err(dbError('Failed to search ServiceDesk KB articles', error))
    }
  },

  /**
   * Sugestões para um chamado: publicados que batem com algum termo do título
   * (OR entre os termos, `to_tsquery('portuguese')`) ou com a categoria/
   * subcategoria/serviço do chamado; o casamento de categoria soma 0,5.
   */
  async suggest(
    workspaceId: string,
    filters: SdKbAudienceFilter & {
      terms: string[]
      categoryIds: string[]
      limit: number
    },
  ): Promise<Result<SdKbSearchRow[]>> {
    try {
      if (filters.terms.length === 0 && filters.categoryIds.length === 0) {
        return ok([])
      }
      const vector = Prisma.sql`(setweight(to_tsvector('portuguese', coalesce(title, '')), 'A') || setweight(to_tsvector('portuguese', coalesce(plain_text, '')), 'B'))`
      const query = Prisma.sql`to_tsquery('portuguese', ${filters.terms.join(' | ')})`
      const categories =
        filters.categoryIds.length > 0
          ? Prisma.sql`category_id IN (${Prisma.join(filters.categoryIds)})`
          : Prisma.sql`FALSE`
      const textMatch =
        filters.terms.length > 0
          ? Prisma.sql`${vector} @@ ${query}`
          : Prisma.sql`FALSE`
      const textRank =
        filters.terms.length > 0
          ? Prisma.sql`ts_rank(${vector}, ${query})`
          : Prisma.sql`0`
      const audience = filters.portalOnly
        ? Prisma.sql`AND visibility = 'PORTAL'::"SdKbVisibility"`
        : Prisma.empty
      const hits = await prisma.$queryRaw<{ id: string; rank: number }[]>`
        SELECT id,
          (${textRank} + CASE WHEN ${categories} THEN 0.5 ELSE 0 END)::float8 AS rank
        FROM sd_kb_articles
        WHERE workspace_id = ${workspaceId}
          AND archived_at IS NULL
          AND status = 'PUBLISHED'::"SdKbArticleStatus"
          ${audience}
          AND (${textMatch} OR ${categories})
        ORDER BY rank DESC, helpful_count DESC, updated_at DESC
        LIMIT ${filters.limit}
      `
      if (hits.length === 0) return ok([])
      const rows = await prisma.sdKbArticle.findMany({
        where: { id: { in: hits.map((h) => h.id) } },
        select: { ...SD_KB_SUMMARY_SELECT, plainText: true },
      })
      const byId = new Map(rows.map((r) => [r.id, r]))
      return ok(
        hits.flatMap((hit) => {
          const row = byId.get(hit.id)
          return row ? [{ ...row, rank: Number(hit.rank) }] : []
        }),
      )
    } catch (error) {
      return err(dbError('Failed to suggest ServiceDesk KB articles', error))
    }
  },

  /** Relacionados: mesma categoria ou alguma tag em comum. */
  async listRelated(
    article: Pick<SdKbArticle, 'id' | 'workspaceId' | 'categoryId' | 'tags'>,
    filters: SdKbAudienceFilter & { limit: number },
  ): Promise<Result<SdKbArticleSummary[]>> {
    try {
      const or: Prisma.SdKbArticleWhereInput[] = []
      if (article.categoryId) or.push({ categoryId: article.categoryId })
      if (article.tags.length > 0) or.push({ tags: { hasSome: article.tags } })
      if (or.length === 0) return ok([])
      const rows = await prisma.sdKbArticle.findMany({
        where: {
          workspaceId: article.workspaceId,
          id: { not: article.id },
          archivedAt: null,
          OR: or,
          ...audienceWhere(filters),
        },
        select: SD_KB_SUMMARY_SELECT,
        orderBy: [{ helpfulCount: 'desc' }, { viewCount: 'desc' }],
        take: filters.limit,
      })
      return ok(rows)
    } catch (error) {
      return err(
        dbError('Failed to list related ServiceDesk KB articles', error),
      )
    }
  },
}
