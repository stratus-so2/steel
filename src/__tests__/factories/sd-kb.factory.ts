import { createId } from '@paralleldrive/cuid2'
import type { Prisma, SdKbArticle, SdKbComment } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { SdKbArticleWithRefs } from '@/src/repositories/sd-kb-article.repository'
import type { SdKbCommentWithAuthor } from '@/src/repositories/sd-kb-comment.repository'

const CONTENT = [{ type: 'p', children: [{ text: 'Passo a passo' }] }]

export function createFakeSdKbArticle(
  overrides?: Partial<SdKbArticleWithRefs>,
): SdKbArticleWithRefs {
  const now = new Date()
  return {
    id: createId(),
    workspaceId: createId(),
    parentId: null,
    title: 'Como redefinir a senha da VPN',
    icon: null,
    coverImage: null,
    content: CONTENT,
    plainText: 'Passo a passo',
    status: 'DRAFT',
    visibility: 'INTERNAL',
    categoryId: null,
    tags: [],
    position: 0,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
    publishedAt: null,
    createdById: null,
    updatedById: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: null,
    updatedBy: null,
    category: null,
    ...overrides,
  }
}

export function createFakeSdKbComment(
  overrides?: Partial<SdKbCommentWithAuthor>,
): SdKbCommentWithAuthor {
  const now = new Date()
  return {
    id: createId(),
    articleId: createId(),
    authorId: createId(),
    parentId: null,
    markId: 'mark-1',
    content: [{ type: 'p', children: [{ text: 'Revisar este passo' }] }],
    resolved: false,
    resolvedAt: null,
    resolvedById: null,
    createdAt: now,
    updatedAt: now,
    author: null,
    ...overrides,
  }
}

export async function seedSdKbArticle(
  workspaceId: string,
  overrides?: Partial<
    Pick<
      SdKbArticle,
      | 'parentId'
      | 'title'
      | 'status'
      | 'visibility'
      | 'categoryId'
      | 'tags'
      | 'position'
      | 'plainText'
      | 'archivedAt'
      | 'createdById'
      | 'helpfulCount'
      | 'notHelpfulCount'
      | 'viewCount'
    >
  > & { content?: Prisma.InputJsonValue },
) {
  return prisma.sdKbArticle.create({
    data: {
      workspaceId,
      title: 'Artigo',
      content: CONTENT,
      ...overrides,
    },
  })
}

export async function seedSdKbComment(
  articleId: string,
  authorId: string,
  overrides?: Partial<Pick<SdKbComment, 'markId' | 'parentId' | 'resolved'>>,
) {
  return prisma.sdKbComment.create({
    data: {
      articleId,
      authorId,
      markId: 'mark-1',
      content: [{ type: 'p', children: [{ text: 'Comentário' }] }],
      ...overrides,
    },
  })
}

export async function seedSdCategory(
  workspaceId: string,
  overrides?: Partial<{
    name: string
    active: boolean
    portalVisible: boolean
    parentId: string
    level: 'CATEGORY' | 'SUBCATEGORY' | 'SERVICE'
  }>,
) {
  return prisma.sdCategory.create({
    data: {
      workspaceId,
      level: 'CATEGORY',
      name: 'Acesso e senhas',
      ...overrides,
    },
  })
}

/** Chamado mínimo (cria a fase inicial exigida pela FK). */
export async function seedSdTicket(
  workspaceId: string,
  overrides?: Partial<{
    title: string
    categoryId: string
    subcategoryId: string
    serviceId: string
    requesterId: string
    createdById: string
    number: number
    deletedAt: Date
  }>,
) {
  const phase = await prisma.sdPhase.create({
    data: {
      workspaceId,
      ticketType: 'INCIDENT',
      name: 'Novo',
      category: 'NEW',
      isInitial: true,
    },
  })
  return prisma.sdTicket.create({
    data: {
      workspaceId,
      number: overrides?.number ?? Math.floor(Math.random() * 1_000_000),
      type: 'INCIDENT',
      title: 'VPN não conecta',
      phaseId: phase.id,
      ...overrides,
    },
  })
}
