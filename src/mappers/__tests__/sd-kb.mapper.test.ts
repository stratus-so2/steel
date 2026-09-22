import { describe, expect, it } from 'vitest'
import {
  createFakeSdKbArticle,
  createFakeSdKbComment,
} from '@/src/__tests__/factories/sd-kb.factory'
import {
  toSdKbArticleDTO,
  toSdKbArticleSummaryDTO,
  toSdKbCategoryDTO,
  toSdKbSearchResultDTO,
  toSdTicketKbLinkDTO,
} from '../sd-kb-article.mapper'
import { toSdKbCommentDTO } from '../sd-kb-comment.mapper'

describe('sd-kb-article mapper', () => {
  it('maps a summary with ISO dates and no content', () => {
    const published = new Date('2026-09-01T10:00:00Z')
    const article = createFakeSdKbArticle({
      publishedAt: published,
      archivedAt: published,
      tags: ['vpn'],
    })
    const dto = toSdKbArticleSummaryDTO(article)
    expect(dto).toMatchObject({
      id: article.id,
      publishedAt: published.toISOString(),
      archivedAt: published.toISOString(),
      tags: ['vpn'],
      createdAt: article.createdAt.toISOString(),
    })
    expect(dto).not.toHaveProperty('content')
    expect(dto).not.toHaveProperty('plainText')
  })

  it('maps the full article with refs, reading time and vote', () => {
    const author = { id: 'u1', name: 'Ana', image: null }
    const article = createFakeSdKbArticle({
      createdBy: author,
      updatedBy: author,
      category: { id: 'c1', name: 'Rede', icon: null },
      plainText: Array(450).fill('palavra').join(' '),
    })
    const dto = toSdKbArticleDTO(article, 'up')
    expect(dto).toMatchObject({
      content: article.content,
      readingMinutes: 3,
      createdBy: author,
      category: { id: 'c1', name: 'Rede', icon: null },
      myVote: 'up',
      publishedAt: null,
      archivedAt: null,
    })
    expect(toSdKbArticleDTO(article).myVote).toBeNull()
  })

  it('maps search results with an excerpt and rank', () => {
    const row = {
      ...createFakeSdKbArticle({ plainText: 'reinicie o roteador' }),
      rank: 0.5,
    }
    const dto = toSdKbSearchResultDTO(row, 'roteador')
    expect(dto).toMatchObject({ excerpt: 'reinicie o roteador', rank: 0.5 })
  })

  it('maps categories and ticket links', () => {
    expect(
      toSdKbCategoryDTO({
        id: 'c1',
        name: 'Rede',
        icon: null,
        description: 'd',
        parentId: null,
        portalVisible: true,
        articleCount: 2,
      }),
    ).toEqual({
      id: 'c1',
      name: 'Rede',
      icon: null,
      description: 'd',
      parentId: null,
      articleCount: 2,
    })

    const createdAt = new Date('2026-09-02T00:00:00Z')
    const article = createFakeSdKbArticle()
    expect(
      toSdTicketKbLinkDTO({
        ticketId: 't1',
        articleId: article.id,
        linkedById: 'u1',
        createdAt,
        article,
      }),
    ).toMatchObject({
      ticketId: 't1',
      linkedById: 'u1',
      createdAt: createdAt.toISOString(),
      article: { id: article.id },
    })
  })
})

describe('sd-kb-comment mapper', () => {
  it('maps a comment and its optional fields', () => {
    const resolvedAt = new Date('2026-09-03T00:00:00Z')
    const comment = createFakeSdKbComment({
      author: { id: 'u1', name: 'Ana', image: null },
      resolved: true,
      resolvedAt,
      resolvedById: 'u1',
      parentId: 'p1',
    })
    expect(toSdKbCommentDTO(comment)).toMatchObject({
      id: comment.id,
      articleId: comment.articleId,
      parentId: 'p1',
      resolved: true,
      resolvedAt: resolvedAt.toISOString(),
      resolvedById: 'u1',
      author: { id: 'u1', name: 'Ana', image: null },
    })
    const bare = toSdKbCommentDTO(createFakeSdKbComment())
    expect(bare).toMatchObject({
      parentId: null,
      resolvedAt: null,
      resolvedById: null,
    })
  })
})
