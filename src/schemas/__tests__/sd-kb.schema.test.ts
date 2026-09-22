import { describe, expect, it } from 'vitest'
import {
  CreateSdKbArticleSchema,
  LinkSdKbArticleToTicketSchema,
  ListSdKbArticlesSchema,
  ListSdKbMentionableMembersSchema,
  MoveSdKbArticleSchema,
  SD_KB_CONTENT_MAX_CHARS,
  SearchSdKbArticlesSchema,
  SetSdKbArticleStatusSchema,
  SuggestSdKbArticlesSchema,
  UpdateSdKbArticleSchema,
  VoteSdKbArticleSchema,
} from '../sd-kb-article.schema'
import {
  CreateSdKbCommentSchema,
  ResolveSdKbCommentSchema,
  UpdateSdKbCommentSchema,
} from '../sd-kb-comment.schema'

const paragraph = [{ type: 'p', children: [{ text: 'oi' }] }]

describe('sd-kb-article schemas', () => {
  describe('CreateSdKbArticleSchema', () => {
    it('defaults the title and accepts optional fields', () => {
      expect(CreateSdKbArticleSchema.parse({})).toEqual({ title: '' })
      const parsed = CreateSdKbArticleSchema.parse({
        title: 'VPN',
        parentId: 'p1',
        icon: '🔐',
        categoryId: 'c1',
        visibility: 'PORTAL',
        tags: [' VPN ', 'vpn', 'Rede'],
      })
      expect(parsed.tags).toEqual(['vpn', 'rede'])
    })

    it('rejects long titles, icons and invalid visibility', () => {
      expect(
        CreateSdKbArticleSchema.safeParse({ title: 'x'.repeat(256) }).success,
      ).toBe(false)
      expect(
        CreateSdKbArticleSchema.safeParse({ icon: 'x'.repeat(17) }).success,
      ).toBe(false)
      expect(
        CreateSdKbArticleSchema.safeParse({ visibility: 'PUBLIC' }).success,
      ).toBe(false)
    })

    it('limits the tags', () => {
      const tags = Array.from({ length: 21 }, (_, i) => `t${i}`)
      expect(CreateSdKbArticleSchema.safeParse({ tags }).success).toBe(false)
      expect(
        CreateSdKbArticleSchema.safeParse({ tags: ['x'.repeat(41)] }).success,
      ).toBe(false)
      expect(CreateSdKbArticleSchema.safeParse({ tags: ['  '] }).success).toBe(
        false,
      )
    })
  })

  describe('UpdateSdKbArticleSchema', () => {
    it('accepts content, nullable metadata and API media covers', () => {
      const parsed = UpdateSdKbArticleSchema.parse({
        content: paragraph,
        icon: null,
        categoryId: null,
        coverImage:
          '/api/workspaces/ws1/servicedesk/knowledge/a1/media/abc123def45.png',
      })
      expect(parsed.content).toEqual(paragraph)
      expect(
        UpdateSdKbArticleSchema.parse({ coverImage: 'https://img.test/a.png' })
          .coverImage,
      ).toBe('https://img.test/a.png')
      expect(
        UpdateSdKbArticleSchema.parse({ coverImage: null }).coverImage,
      ).toBe(null)
    })

    it('rejects foreign covers and oversized content', () => {
      expect(
        UpdateSdKbArticleSchema.safeParse({ coverImage: 'javascript:alert(1)' })
          .success,
      ).toBe(false)
      expect(
        UpdateSdKbArticleSchema.safeParse({ coverImage: '/etc/passwd' })
          .success,
      ).toBe(false)
      const big = [
        {
          type: 'p',
          children: [{ text: 'x'.repeat(SD_KB_CONTENT_MAX_CHARS) }],
        },
      ]
      expect(UpdateSdKbArticleSchema.safeParse({ content: big }).success).toBe(
        false,
      )
    })
  })

  it('MoveSdKbArticleSchema requires a non-negative integer position', () => {
    expect(
      MoveSdKbArticleSchema.parse({ parentId: null, position: 0 }),
    ).toEqual({ parentId: null, position: 0 })
    expect(
      MoveSdKbArticleSchema.safeParse({ parentId: 'p', position: -1 }).success,
    ).toBe(false)
    expect(
      MoveSdKbArticleSchema.safeParse({ parentId: 'p', position: 1.5 }).success,
    ).toBe(false)
  })

  it('SetSdKbArticleStatusSchema accepts DRAFT and PUBLISHED only', () => {
    expect(SetSdKbArticleStatusSchema.parse({ status: 'PUBLISHED' })).toEqual({
      status: 'PUBLISHED',
    })
    expect(SetSdKbArticleStatusSchema.safeParse({ status: 'X' }).success).toBe(
      false,
    )
  })

  it('ListSdKbArticlesSchema turns the archived flag into a boolean', () => {
    expect(ListSdKbArticlesSchema.parse({}).archived).toBe(false)
    expect(ListSdKbArticlesSchema.parse({ archived: 'true' }).archived).toBe(
      true,
    )
    expect(ListSdKbArticlesSchema.parse({ archived: 'false' }).archived).toBe(
      false,
    )
  })

  it('SearchSdKbArticlesSchema trims, lowercases tags and coerces the limit', () => {
    expect(SearchSdKbArticlesSchema.parse({})).toEqual({ q: '', limit: 20 })
    expect(
      SearchSdKbArticlesSchema.parse({ q: '  vpn ', tag: 'VPN', limit: '5' }),
    ).toEqual({ q: 'vpn', tag: 'vpn', limit: 5 })
    expect(SearchSdKbArticlesSchema.safeParse({ limit: '51' }).success).toBe(
      false,
    )
  })

  it('VoteSdKbArticleSchema accepts true, false and null', () => {
    for (const helpful of [true, false, null]) {
      expect(VoteSdKbArticleSchema.parse({ helpful })).toEqual({ helpful })
    }
    expect(VoteSdKbArticleSchema.safeParse({}).success).toBe(false)
  })

  it('ticket link, suggest and members schemas', () => {
    expect(
      LinkSdKbArticleToTicketSchema.safeParse({ articleId: '' }).success,
    ).toBe(false)
    expect(SuggestSdKbArticlesSchema.parse({ ticketId: 't1' })).toEqual({
      ticketId: 't1',
      limit: 5,
    })
    expect(ListSdKbMentionableMembersSchema.parse({})).toEqual({ q: '' })
  })
})

describe('sd-kb-comment schemas', () => {
  it('validates create, update and resolve payloads', () => {
    expect(
      CreateSdKbCommentSchema.parse({ markId: 'm', content: paragraph }),
    ).toEqual({ markId: 'm', content: paragraph })
    expect(
      CreateSdKbCommentSchema.safeParse({ markId: '', content: paragraph })
        .success,
    ).toBe(false)
    expect(
      CreateSdKbCommentSchema.safeParse({ markId: 'm', content: [] }).success,
    ).toBe(false)
    expect(
      UpdateSdKbCommentSchema.safeParse({
        content: [{ type: 'p', children: [{ text: 'x'.repeat(20_001) }] }],
      }).success,
    ).toBe(false)
    expect(ResolveSdKbCommentSchema.parse({ resolved: true })).toEqual({
      resolved: true,
    })
  })
})
