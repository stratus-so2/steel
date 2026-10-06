import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeSdKbArticle,
  createFakeSdKbComment,
} from '@/src/__tests__/factories/sd-kb.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-access.helpers'
import {
  databaseError,
  sdKbArticleNotFound,
  sdKbCommentNotFound,
} from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-kb-article.repository')
vi.mock('@/src/repositories/sd-kb-comment.repository')
vi.mock('@/lib/axiom/audit')
vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('../sd-notification.service', () => ({ notifySdUsers: vi.fn() }))

import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import { SdKbArticleRepository } from '@/src/repositories/sd-kb-article.repository'
import { SdKbCommentRepository } from '@/src/repositories/sd-kb-comment.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import {
  SdKbCommentService,
  sdKbCommentPreview,
} from '../sd-kb-comment.service'
import { notifySdUsers } from '../sd-notification.service'

const articles = vi.mocked(SdKbArticleRepository)
const comments = vi.mocked(SdKbCommentRepository)
const moduleAccess = vi.mocked(WorkspaceModuleAccessRepository)
const audit = vi.mocked(auditMutation)

const WS = 'ws1'
const ARTICLE = 'a1'
const content = [{ type: 'p', children: [{ text: 'ok' }] }]
const root = createFakeSdKbComment({
  id: 'root',
  articleId: ARTICLE,
  authorId: 'u1',
  markId: 'm1',
})
const reply = createFakeSdKbComment({
  id: 'reply',
  articleId: ARTICLE,
  authorId: 'u2',
  markId: 'm1',
  parentId: 'root',
})

const notify = vi.mocked(notifySdUsers)

beforeEach(() => {
  notify.mockReset()
  notify.mockResolvedValue(ok({ recipients: 1, inApp: 1 }))
  moduleAccess.isEnabled.mockResolvedValue(ok(true))
  articles.findById.mockResolvedValue(
    ok(createFakeSdKbArticle({ id: ARTICLE, workspaceId: WS })),
  )
})

describe('SdKbCommentService', () => {
  describe('access', () => {
    it('refuses requesters, viewers and articles of another workspace', async () => {
      actAs('requester')
      expectErr(
        await SdKbCommentService.list('u1', WS, ARTICLE),
        'SD_NOT_AGENT',
      )

      actAs('viewer-agent')
      expectErr(
        await SdKbCommentService.create('u1', WS, ARTICLE, {
          markId: 'm',
          content,
        }),
        'FORBIDDEN',
      )

      actAs('agent')
      articles.findById.mockResolvedValue(err(sdKbArticleNotFound()))
      expectErr(
        await SdKbCommentService.list('u1', WS, 'other'),
        'SD_KB_ARTICLE_NOT_FOUND',
      )
    })
  })

  describe('list()', () => {
    it('lists the discussions of the article', async () => {
      actAs('viewer-agent')
      comments.listByArticle.mockResolvedValue(ok([root, reply]))
      const rows = expectOk(await SdKbCommentService.list('u1', WS, ARTICLE))
      expect(rows.map((c) => c.id)).toEqual(['root', 'reply'])
    })

    it('propagates failures', async () => {
      actAs('agent')
      comments.listByArticle.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbCommentService.list('u1', WS, ARTICLE),
        'DATABASE_ERROR',
      )
    })
  })

  describe('create()', () => {
    beforeEach(() => actAs('agent'))

    it('creates a root comment and audits', async () => {
      comments.create.mockResolvedValue(ok(root))
      expectOk(
        await SdKbCommentService.create('u1', WS, ARTICLE, {
          markId: 'm1',
          content,
        }),
      )
      expect(comments.create).toHaveBeenCalledWith({
        articleId: ARTICLE,
        authorId: 'u1',
        markId: 'm1',
        content,
        parentId: undefined,
      })
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({ entity: 'sd_kb_comment', action: 'create' }),
      )
    })

    it("joins the parent's discussion, ignoring the client markId", async () => {
      comments.findById.mockResolvedValue(ok(root))
      comments.create.mockResolvedValue(ok(reply))
      expectOk(
        await SdKbCommentService.create('u2', WS, ARTICLE, {
          markId: 'forged',
          content,
          parentId: 'root',
        }),
      )
      expect(comments.create).toHaveBeenCalledWith(
        expect.objectContaining({ markId: 'm1', parentId: 'root' }),
      )
    })

    it('refuses replies to replies, parents elsewhere and write failures', async () => {
      comments.findById.mockResolvedValue(ok(reply))
      expectErr(
        await SdKbCommentService.create('u1', WS, ARTICLE, {
          markId: 'm',
          content,
          parentId: 'reply',
        }),
        'SD_KB_COMMENT_NESTING_TOO_DEEP',
      )
      comments.findById.mockResolvedValue(ok({ ...root, articleId: 'other' }))
      expectErr(
        await SdKbCommentService.create('u1', WS, ARTICLE, {
          markId: 'm',
          content,
          parentId: 'root',
        }),
        'SD_KB_COMMENT_NOT_FOUND',
      )
      comments.findById.mockResolvedValue(err(sdKbCommentNotFound()))
      expectErr(
        await SdKbCommentService.create('u1', WS, ARTICLE, {
          markId: 'm',
          content,
          parentId: 'x',
        }),
        'SD_KB_COMMENT_NOT_FOUND',
      )
      comments.create.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbCommentService.create('u1', WS, ARTICLE, {
          markId: 'm',
          content,
        }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('update()', () => {
    beforeEach(() => actAs('agent'))

    it('lets only the author edit', async () => {
      comments.findById.mockResolvedValue(ok(root))
      comments.update.mockResolvedValue(ok(root))
      expectOk(
        await SdKbCommentService.update('u1', WS, ARTICLE, 'root', { content }),
      )
      expectErr(
        await SdKbCommentService.update('u9', WS, ARTICLE, 'root', { content }),
        'SD_KB_COMMENT_FORBIDDEN',
      )
    })

    it('propagates failures', async () => {
      comments.findById.mockResolvedValue(err(sdKbCommentNotFound()))
      expectErr(
        await SdKbCommentService.update('u1', WS, ARTICLE, 'x', { content }),
        'SD_KB_COMMENT_NOT_FOUND',
      )
      comments.findById.mockResolvedValue(ok(root))
      comments.update.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbCommentService.update('u1', WS, ARTICLE, 'root', { content }),
        'DATABASE_ERROR',
      )
      actAs('requester')
      expectErr(
        await SdKbCommentService.update('u1', WS, ARTICLE, 'root', { content }),
        'SD_NOT_AGENT',
      )
    })
  })

  describe('resolve()', () => {
    beforeEach(() => actAs('agent'))

    it('resolves and reopens a root discussion', async () => {
      comments.findById.mockResolvedValue(ok(root))
      comments.resolve.mockResolvedValue(ok({ ...root, resolved: true }))
      expectOk(
        await SdKbCommentService.resolve('u2', WS, ARTICLE, 'root', {
          resolved: true,
        }),
      )
      expect(comments.resolve).toHaveBeenCalledWith('root', {
        resolved: true,
        resolvedById: 'u2',
      })
      expect(audit).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: 'resolve' }),
      )

      expectOk(
        await SdKbCommentService.resolve('u2', WS, ARTICLE, 'root', {
          resolved: false,
        }),
      )
      expect(comments.resolve).toHaveBeenLastCalledWith('root', {
        resolved: false,
        resolvedById: null,
      })
      expect(audit).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: 'unresolve' }),
      )
    })

    it('refuses replies and propagates failures', async () => {
      comments.findById.mockResolvedValue(ok(reply))
      expectErr(
        await SdKbCommentService.resolve('u1', WS, ARTICLE, 'reply', {
          resolved: true,
        }),
        'SD_KB_COMMENT_FORBIDDEN',
      )
      comments.findById.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbCommentService.resolve('u1', WS, ARTICLE, 'root', {
          resolved: true,
        }),
        'DATABASE_ERROR',
      )
      comments.findById.mockResolvedValue(ok(root))
      comments.resolve.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbCommentService.resolve('u1', WS, ARTICLE, 'root', {
          resolved: true,
        }),
        'DATABASE_ERROR',
      )
      actAs('requester')
      expectErr(
        await SdKbCommentService.resolve('u1', WS, ARTICLE, 'root', {
          resolved: true,
        }),
        'SD_NOT_AGENT',
      )
    })
  })

  describe('delete()', () => {
    it('lets the author or an admin delete', async () => {
      actAs('agent')
      comments.findById.mockResolvedValue(ok(root))
      comments.delete.mockResolvedValue(ok(undefined))
      expectOk(await SdKbCommentService.delete('u1', WS, ARTICLE, 'root'))
      expectErr(
        await SdKbCommentService.delete('u9', WS, ARTICLE, 'root'),
        'SD_KB_COMMENT_FORBIDDEN',
      )
      actAs('admin')
      expectOk(await SdKbCommentService.delete('u9', WS, ARTICLE, 'root'))
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'delete',
          meta: { articleId: ARTICLE },
        }),
      )
    })

    it('propagates failures', async () => {
      actAs('agent')
      comments.findById.mockResolvedValue(err(sdKbCommentNotFound()))
      expectErr(
        await SdKbCommentService.delete('u1', WS, ARTICLE, 'x'),
        'SD_KB_COMMENT_NOT_FOUND',
      )
      comments.findById.mockResolvedValue(ok(root))
      comments.delete.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbCommentService.delete('u1', WS, ARTICLE, 'root'),
        'DATABASE_ERROR',
      )
      actAs('requester')
      expectErr(
        await SdKbCommentService.delete('u1', WS, ARTICLE, 'root'),
        'SD_NOT_AGENT',
      )
    })
  })
})

describe('SdKbCommentService.create · author notice', () => {
  beforeEach(() => {
    actAs('agent')
    articles.findById.mockResolvedValue(
      ok(
        createFakeSdKbArticle({
          id: ARTICLE,
          workspaceId: WS,
          title: 'VPN no Windows',
          createdById: 'author',
        }),
      ),
    )
    comments.create.mockResolvedValue(ok(root))
  })

  it('tells the article author, never the commenter', async () => {
    expectOk(
      await SdKbCommentService.create('u1', WS, ARTICLE, {
        markId: 'm1',
        content,
      }),
    )
    const [input] = notify.mock.calls[0]
    expect(input).toMatchObject({
      workspaceId: WS,
      event: 'kb.comment',
      userIds: ['author'],
      actorId: 'u1',
      title: 'Novo comentário em "VPN no Windows"',
      body: 'ok',
    })
    expect(input.hrefFor('acme')).toBe(`/acme/servicedesk/knowledge/${ARTICLE}`)
  })

  it('skips an article without a known author', async () => {
    articles.findById.mockResolvedValue(
      ok(createFakeSdKbArticle({ id: ARTICLE, createdById: null })),
    )
    expectOk(
      await SdKbCommentService.create('u1', WS, ARTICLE, {
        markId: 'm1',
        content,
      }),
    )
    expect(notify).not.toHaveBeenCalled()
  })

  it('keeps the comment when the notice fails', async () => {
    notify.mockResolvedValue(err(databaseError()))
    expectOk(
      await SdKbCommentService.create('u1', WS, ARTICLE, {
        markId: 'm1',
        content,
      }),
    )
    expect(logger.warn).toHaveBeenCalledWith(
      'servicedesk.kb_comment.notify_failed',
      expect.objectContaining({ articleId: ARTICLE }),
    )
  })

  it('does not notify when the comment was not saved', async () => {
    comments.create.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdKbCommentService.create('u1', WS, ARTICLE, {
        markId: 'm1',
        content,
      }),
    )
    expect(notify).not.toHaveBeenCalled()
  })
})

describe('sdKbCommentPreview', () => {
  it('flattens the Plate value into plain text', () => {
    expect(
      sdKbCommentPreview([
        { type: 'p', children: [{ text: 'Olá' }, { text: ' mundo' }] },
        { type: 'p', children: [{ text: '\n segundo ' }] },
        null,
        'solto',
      ]),
    ).toBe('Olá mundo segundo')
  })

  it('truncates long text and has a fallback for empty content', () => {
    const long = sdKbCommentPreview([{ text: 'x'.repeat(300) }])
    expect(long).toHaveLength(140)
    expect(sdKbCommentPreview([])).toBe('Novo comentário')
    expect(sdKbCommentPreview(undefined)).toBe('Novo comentário')
  })
})
