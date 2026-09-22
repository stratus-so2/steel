import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSdKbArticle } from '@/src/__tests__/factories/sd-kb.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-access.helpers'
import { databaseError, sdCategoryNotFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-kb-article.repository')
vi.mock('@/src/repositories/sd-kb-catalog.repository')
vi.mock('@/src/cache/sd-kb-engagement.cache')
vi.mock('@/src/services/sd-kb-media.service')
vi.mock('@/lib/axiom/audit')

import { auditMutation } from '@/lib/axiom/audit'
import { SdKbEngagementCache } from '@/src/cache/sd-kb-engagement.cache'
import { SdKbArticleRepository } from '@/src/repositories/sd-kb-article.repository'
import { SdKbCatalogRepository } from '@/src/repositories/sd-kb-catalog.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { SdKbArticleService } from '../sd-kb-article.service'
import { SdKbMediaService } from '../sd-kb-media.service'

const repo = vi.mocked(SdKbArticleRepository)
const catalog = vi.mocked(SdKbCatalogRepository)
const cache = vi.mocked(SdKbEngagementCache)
const media = vi.mocked(SdKbMediaService)
const moduleAccess = vi.mocked(WorkspaceModuleAccessRepository)
const audit = vi.mocked(auditMutation)

const WS = 'ws1'
const draft = createFakeSdKbArticle({ id: 'a1', workspaceId: WS })
const portal = createFakeSdKbArticle({
  id: 'a2',
  workspaceId: WS,
  status: 'PUBLISHED',
  visibility: 'PORTAL',
  helpfulCount: 3,
  notHelpfulCount: 1,
})

beforeEach(() => {
  moduleAccess.isEnabled.mockResolvedValue(ok(true))
  cache.getVote.mockResolvedValue(null)
})

describe('SdKbArticleService', () => {
  describe('authorization', () => {
    it('refuses non-members and a disabled module', async () => {
      actAs('non-member')
      expectErr(
        await SdKbArticleService.list('u1', WS, { archived: false }),
        'FORBIDDEN',
      )

      actAs('agent')
      moduleAccess.isEnabled.mockResolvedValue(ok(false))
      expectErr(
        await SdKbArticleService.getById('u1', WS, 'a1'),
        'MODULE_DISABLED',
      )
    })

    it.each([
      ['create', () => SdKbArticleService.create('u1', WS, { title: 'x' })],
      [
        'update',
        () => SdKbArticleService.update('u1', WS, 'a1', { title: 'y' }),
      ],
      [
        'move',
        () =>
          SdKbArticleService.move('u1', WS, 'a1', {
            parentId: null,
            position: 0,
          }),
      ],
      ['archive', () => SdKbArticleService.archive('u1', WS, 'a1')],
    ] as const)('denies a VIEWER agent on %s', async (_name, call) => {
      actAs('viewer-agent')
      expectErr(await call(), 'FORBIDDEN')
      expect(repo.create).not.toHaveBeenCalled()
      expect(repo.update).not.toHaveBeenCalled()
    })

    it.each([
      ['create', () => SdKbArticleService.create('u1', WS, { title: 'x' })],
      [
        'setStatus',
        () =>
          SdKbArticleService.setStatus('u1', WS, 'a1', { status: 'PUBLISHED' }),
      ],
      ['restore', () => SdKbArticleService.restore('u1', WS, 'a1')],
      [
        'members',
        () => SdKbArticleService.listMentionableMembers('u1', WS, ''),
      ],
    ] as const)('refuses requesters on %s with SD_NOT_AGENT', async (_n, call) => {
      actAs('requester')
      expectErr(await call(), 'SD_NOT_AGENT')
    })

    it('only lets admins (DELETE) remove articles', async () => {
      actAs('agent')
      expectErr(await SdKbArticleService.remove('u1', WS, 'a1'), 'FORBIDDEN')
      expect(repo.delete).not.toHaveBeenCalled()
    })
  })

  describe('list()', () => {
    it('lists the whole tree for agents', async () => {
      actAs('agent')
      repo.listByWorkspace.mockResolvedValue(ok([draft]))
      const rows = expectOk(
        await SdKbArticleService.list('u1', WS, { archived: false }),
      )
      expect(rows.map((r) => r.id)).toEqual(['a1'])
      expect(repo.listByWorkspace).toHaveBeenCalledWith(WS, {
        archived: false,
        portalOnly: false,
      })
    })

    it('restricts requesters to the portal and refuses the archive', async () => {
      actAs('requester')
      repo.listByWorkspace.mockResolvedValue(ok([portal]))
      expectOk(await SdKbArticleService.list('u1', WS, { archived: false }))
      expect(repo.listByWorkspace).toHaveBeenCalledWith(WS, {
        archived: false,
        portalOnly: true,
      })
      expectErr(
        await SdKbArticleService.list('u1', WS, { archived: true }),
        'SD_NOT_AGENT',
      )
    })

    it('propagates repository errors', async () => {
      actAs('agent')
      repo.listByWorkspace.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbArticleService.list('u1', WS, { archived: false }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('getById()', () => {
    it('returns the article with the reader vote', async () => {
      actAs('agent')
      repo.findById.mockResolvedValue(ok(draft))
      cache.getVote.mockResolvedValue('down')
      const dto = expectOk(await SdKbArticleService.getById('u1', WS, 'a1'))
      expect(dto).toMatchObject({ id: 'a1', myVote: 'down' })
      expect(repo.findById).toHaveBeenCalledWith('a1', WS)
    })

    it('hides drafts from requesters but shows portal articles', async () => {
      actAs('requester')
      repo.findById.mockResolvedValue(ok(draft))
      expectErr(
        await SdKbArticleService.getById('u1', WS, 'a1'),
        'SD_KB_ARTICLE_NOT_FOUND',
      )
      repo.findById.mockResolvedValue(ok(portal))
      expectOk(await SdKbArticleService.getById('u1', WS, 'a2'))
      repo.findById.mockResolvedValue(ok({ ...portal, archivedAt: new Date() }))
      expectErr(
        await SdKbArticleService.getById('u1', WS, 'a2'),
        'SD_KB_ARTICLE_NOT_FOUND',
      )
    })

    it('propagates a missing article (cross-workspace ids)', async () => {
      actAs('agent')
      repo.findById.mockResolvedValue(
        err({ code: 'SD_KB_ARTICLE_NOT_FOUND', message: 'x' }),
      )
      expectErr(
        await SdKbArticleService.getById('u1', WS, 'other'),
        'SD_KB_ARTICLE_NOT_FOUND',
      )
    })
  })

  describe('create()', () => {
    it('creates under a live parent with a valid category and audits', async () => {
      actAs('agent')
      repo.findById.mockResolvedValue(ok(draft))
      catalog.findCategory.mockResolvedValue(ok({ id: 'c1', name: 'Rede' }))
      repo.create.mockResolvedValue(ok({ ...draft, id: 'new' }))

      const dto = expectOk(
        await SdKbArticleService.create('u1', WS, {
          title: 'Novo',
          parentId: 'a1',
          categoryId: 'c1',
          tags: ['vpn'],
          visibility: 'PORTAL',
        }),
      )
      expect(dto.id).toBe('new')
      expect(repo.create).toHaveBeenCalledWith({
        workspaceId: WS,
        parentId: 'a1',
        title: 'Novo',
        icon: undefined,
        categoryId: 'c1',
        visibility: 'PORTAL',
        tags: ['vpn'],
        createdById: 'u1',
      })
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'sd_kb_article',
          action: 'create',
          targetId: 'new',
        }),
      )
    })

    it('creates at the root without category', async () => {
      actAs('agent')
      repo.create.mockResolvedValue(ok(draft))
      expectOk(await SdKbArticleService.create('u1', WS, { title: '' }))
      expect(repo.findById).not.toHaveBeenCalled()
      expect(catalog.findCategory).not.toHaveBeenCalled()
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: null }),
      )
    })

    it('rejects missing or archived parents and unknown categories', async () => {
      actAs('agent')
      repo.findById.mockResolvedValue(
        err({ code: 'SD_KB_ARTICLE_NOT_FOUND', message: 'x' }),
      )
      expectErr(
        await SdKbArticleService.create('u1', WS, { title: '', parentId: 'p' }),
        'SD_KB_ARTICLE_NOT_FOUND',
      )
      repo.findById.mockResolvedValue(ok({ ...draft, archivedAt: new Date() }))
      expectErr(
        await SdKbArticleService.create('u1', WS, { title: '', parentId: 'p' }),
        'SD_KB_ARTICLE_MOVE_INVALID',
      )
      catalog.findCategory.mockResolvedValue(err(sdCategoryNotFound()))
      expectErr(
        await SdKbArticleService.create('u1', WS, {
          title: '',
          categoryId: 'other-ws',
        }),
        'SD_CATEGORY_NOT_FOUND',
      )
      expect(repo.create).not.toHaveBeenCalled()
    })

    it('audits a failed insert', async () => {
      actAs('agent')
      repo.create.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbArticleService.create('u1', WS, { title: '' }),
        'DATABASE_ERROR',
      )
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'failure', targetId: undefined }),
      )
    })
  })

  describe('update()', () => {
    it('recomputes plain text on content autosave without auditing', async () => {
      actAs('agent')
      repo.findById.mockResolvedValue(ok(draft))
      repo.update.mockResolvedValue(ok(draft))
      const content = [{ type: 'p', children: [{ text: 'Reinicie o modem' }] }]

      expectOk(await SdKbArticleService.update('u1', WS, 'a1', { content }))
      expect(repo.update).toHaveBeenCalledWith(
        'a1',
        expect.objectContaining({
          content,
          plainText: 'Reinicie o modem',
          updatedById: 'u1',
        }),
      )
      expect(audit).not.toHaveBeenCalled()
    })

    it('audits metadata edits and validates the category', async () => {
      actAs('agent')
      repo.findById.mockResolvedValue(ok(draft))
      catalog.findCategory.mockResolvedValue(ok({ id: 'c1', name: 'Rede' }))
      repo.update.mockResolvedValue(ok(draft))

      expectOk(
        await SdKbArticleService.update('u1', WS, 'a1', {
          title: 'Novo',
          categoryId: 'c1',
          visibility: 'PORTAL',
        }),
      )
      expect(repo.update).toHaveBeenCalledWith(
        'a1',
        expect.objectContaining({ plainText: undefined, categoryId: 'c1' }),
      )
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          meta: { fields: ['title', 'categoryId', 'visibility'] },
        }),
      )
    })

    it('propagates lookup, category and write failures (audited)', async () => {
      actAs('agent')
      repo.findById.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbArticleService.update('u1', WS, 'a1', { title: 'x' }),
        'DATABASE_ERROR',
      )

      repo.findById.mockResolvedValue(ok(draft))
      catalog.findCategory.mockResolvedValue(err(sdCategoryNotFound()))
      expectErr(
        await SdKbArticleService.update('u1', WS, 'a1', { categoryId: 'x' }),
        'SD_CATEGORY_NOT_FOUND',
      )

      repo.update.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbArticleService.update('u1', WS, 'a1', { content: [] }),
        'DATABASE_ERROR',
      )
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'failure', action: 'update' }),
      )
    })
  })

  describe('setStatus()', () => {
    it('publishes and unpublishes with the matching audit action', async () => {
      actAs('agent')
      repo.findById.mockResolvedValue(ok({ ...draft, title: 'VPN' }))
      repo.setStatus.mockResolvedValue(ok(portal))

      expectOk(
        await SdKbArticleService.setStatus('u1', WS, 'a1', {
          status: 'PUBLISHED',
        }),
      )
      expect(repo.setStatus).toHaveBeenCalledWith('a1', 'PUBLISHED', 'u1')
      expect(audit).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: 'publish' }),
      )

      expectOk(
        await SdKbArticleService.setStatus('u1', WS, 'a1', { status: 'DRAFT' }),
      )
      expect(audit).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: 'unpublish' }),
      )
    })

    it('refuses to publish untitled or archived articles', async () => {
      actAs('agent')
      repo.findById.mockResolvedValue(ok({ ...draft, title: '  ' }))
      expectErr(
        await SdKbArticleService.setStatus('u1', WS, 'a1', {
          status: 'PUBLISHED',
        }),
        'VALIDATION_ERROR',
      )
      repo.findById.mockResolvedValue(
        ok({ ...draft, title: 'x', archivedAt: new Date() }),
      )
      expectErr(
        await SdKbArticleService.setStatus('u1', WS, 'a1', {
          status: 'PUBLISHED',
        }),
        'VALIDATION_ERROR',
      )
      expect(repo.setStatus).not.toHaveBeenCalled()
    })

    it('propagates lookup and write failures', async () => {
      actAs('agent')
      repo.findById.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbArticleService.setStatus('u1', WS, 'a1', { status: 'DRAFT' }),
        'DATABASE_ERROR',
      )
      repo.findById.mockResolvedValue(ok(draft))
      repo.setStatus.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbArticleService.setStatus('u1', WS, 'a1', { status: 'DRAFT' }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('move()', () => {
    beforeEach(() => actAs('agent'))

    it('moves to the root', async () => {
      repo.findById.mockResolvedValue(ok(draft))
      repo.move.mockResolvedValue(ok(draft))
      expectOk(
        await SdKbArticleService.move('u1', WS, 'a1', {
          parentId: null,
          position: 2,
        }),
      )
      expect(repo.move).toHaveBeenCalledWith('a1', WS, {
        parentId: null,
        position: 2,
        updatedById: 'u1',
      })
      expect(repo.listAncestorIds).not.toHaveBeenCalled()
    })

    it('moves under another live article', async () => {
      repo.findById.mockResolvedValue(ok(draft))
      repo.listAncestorIds.mockResolvedValue(ok(['root']))
      repo.move.mockResolvedValue(ok(draft))
      expectOk(
        await SdKbArticleService.move('u1', WS, 'a1', {
          parentId: 'p1',
          position: 0,
        }),
      )
      expect(repo.listAncestorIds).toHaveBeenCalledWith('p1', WS)
    })

    it('prevents cycles: itself, a descendant or an archived target', async () => {
      repo.findById.mockResolvedValue(ok(draft))
      expectErr(
        await SdKbArticleService.move('u1', WS, 'a1', {
          parentId: 'a1',
          position: 0,
        }),
        'SD_KB_ARTICLE_MOVE_INVALID',
      )
      repo.listAncestorIds.mockResolvedValue(ok(['child', 'a1']))
      expectErr(
        await SdKbArticleService.move('u1', WS, 'a1', {
          parentId: 'grandchild',
          position: 0,
        }),
        'SD_KB_ARTICLE_MOVE_INVALID',
      )
      repo.findById
        .mockResolvedValueOnce(ok(draft))
        .mockResolvedValueOnce(ok({ ...draft, archivedAt: new Date() }))
      expectErr(
        await SdKbArticleService.move('u1', WS, 'a1', {
          parentId: 'p1',
          position: 0,
        }),
        'SD_KB_ARTICLE_MOVE_INVALID',
      )
      expect(repo.move).not.toHaveBeenCalled()
    })

    it('propagates lookup and write failures', async () => {
      repo.findById.mockResolvedValueOnce(err(databaseError()))
      expectErr(
        await SdKbArticleService.move('u1', WS, 'a1', {
          parentId: null,
          position: 0,
        }),
        'DATABASE_ERROR',
      )
      repo.findById
        .mockResolvedValueOnce(ok(draft))
        .mockResolvedValueOnce(
          err({ code: 'SD_KB_ARTICLE_NOT_FOUND', message: 'x' }),
        )
      expectErr(
        await SdKbArticleService.move('u1', WS, 'a1', {
          parentId: 'other-ws',
          position: 0,
        }),
        'SD_KB_ARTICLE_NOT_FOUND',
      )
      repo.findById.mockResolvedValue(ok(draft))
      repo.listAncestorIds.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbArticleService.move('u1', WS, 'a1', {
          parentId: 'p1',
          position: 0,
        }),
        'DATABASE_ERROR',
      )
      repo.move.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbArticleService.move('u1', WS, 'a1', {
          parentId: null,
          position: 0,
        }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('archive() and restore()', () => {
    beforeEach(() => actAs('agent'))

    it('archives and restores', async () => {
      repo.findById.mockResolvedValue(ok(draft))
      repo.archive.mockResolvedValue(ok({ ...draft, archivedAt: new Date() }))
      expect(
        expectOk(await SdKbArticleService.archive('u1', WS, 'a1')).archivedAt,
      ).not.toBeNull()

      repo.findById.mockResolvedValue(ok({ ...draft, archivedAt: new Date() }))
      repo.restore.mockResolvedValue(ok(draft))
      expectOk(await SdKbArticleService.restore('u1', WS, 'a1'))
      expect(repo.restore).toHaveBeenCalledWith('a1', 'u1')
    })

    it('restoring a live article is a no-op', async () => {
      repo.findById.mockResolvedValue(ok(draft))
      expectOk(await SdKbArticleService.restore('u1', WS, 'a1'))
      expect(repo.restore).not.toHaveBeenCalled()
    })

    it('propagates failures', async () => {
      repo.findById.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbArticleService.archive('u1', WS, 'a1'),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdKbArticleService.restore('u1', WS, 'a1'),
        'DATABASE_ERROR',
      )
      repo.findById.mockResolvedValue(ok({ ...draft, archivedAt: new Date() }))
      repo.archive.mockResolvedValue(err(databaseError()))
      repo.restore.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbArticleService.archive('u1', WS, 'a1'),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdKbArticleService.restore('u1', WS, 'a1'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('remove()', () => {
    beforeEach(() => actAs('admin'))

    it('deletes the subtree and purges votes and media', async () => {
      repo.findById.mockResolvedValue(ok(draft))
      repo.listSubtreeIds.mockResolvedValue(ok(['a1', 'c1']))
      repo.delete.mockResolvedValue(ok(undefined))
      expectOk(await SdKbArticleService.remove('u1', WS, 'a1'))
      expect(cache.forgetArticle).toHaveBeenCalledTimes(2)
      expect(media.purgeArticles).toHaveBeenCalledWith(WS, ['a1', 'c1'])
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'delete', meta: { subtreeSize: 2 } }),
      )
    })

    it('propagates failures without purging', async () => {
      repo.findById.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbArticleService.remove('u1', WS, 'a1'),
        'DATABASE_ERROR',
      )
      repo.findById.mockResolvedValue(ok(draft))
      repo.listSubtreeIds.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbArticleService.remove('u1', WS, 'a1'),
        'DATABASE_ERROR',
      )
      repo.listSubtreeIds.mockResolvedValue(ok(['a1']))
      repo.delete.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbArticleService.remove('u1', WS, 'a1'),
        'DATABASE_ERROR',
      )
      expect(media.purgeArticles).not.toHaveBeenCalled()
    })
  })

  describe('search()', () => {
    const row = { ...portal, rank: 1 }

    it('passes agent filters through', async () => {
      actAs('agent')
      repo.search.mockResolvedValue(ok([row]))
      const results = expectOk(
        await SdKbArticleService.search('u1', WS, {
          q: 'vpn',
          status: 'DRAFT',
          visibility: 'INTERNAL',
          categoryId: 'c1',
          tag: 't',
          limit: 10,
        }),
      )
      expect(results[0]).toMatchObject({ id: 'a2', rank: 1 })
      expect(repo.search).toHaveBeenCalledWith(WS, {
        q: 'vpn',
        status: 'DRAFT',
        visibility: 'INTERNAL',
        categoryId: 'c1',
        tag: 't',
        limit: 10,
        portalOnly: false,
      })
    })

    it('forces the portal audience for requesters', async () => {
      actAs('requester')
      repo.search.mockResolvedValue(ok([]))
      expectOk(
        await SdKbArticleService.search('u1', WS, {
          q: '',
          status: 'DRAFT',
          limit: 5,
        }),
      )
      expect(repo.search).toHaveBeenCalledWith(
        WS,
        expect.objectContaining({
          status: undefined,
          visibility: undefined,
          portalOnly: true,
        }),
      )
    })

    it('propagates failures', async () => {
      actAs('agent')
      repo.search.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbArticleService.search('u1', WS, { q: '', limit: 5 }),
        'DATABASE_ERROR',
      )
      actAs('non-member')
      expectErr(
        await SdKbArticleService.search('u1', WS, { q: '', limit: 5 }),
        'FORBIDDEN',
      )
    })
  })

  describe('listCategories()', () => {
    it('lists with the reader audience', async () => {
      actAs('requester')
      catalog.listCategoriesWithCounts.mockResolvedValue(
        ok([
          {
            id: 'c1',
            name: 'Rede',
            icon: null,
            description: null,
            parentId: null,
            portalVisible: true,
            articleCount: 1,
          },
        ]),
      )
      const rows = expectOk(await SdKbArticleService.listCategories('u1', WS))
      expect(rows[0]).toMatchObject({ id: 'c1', articleCount: 1 })
      expect(catalog.listCategoriesWithCounts).toHaveBeenCalledWith(WS, true)
    })

    it('propagates failures', async () => {
      actAs('agent')
      catalog.listCategoriesWithCounts.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbArticleService.listCategories('u1', WS),
        'DATABASE_ERROR',
      )
      actAs('non-member')
      expectErr(await SdKbArticleService.listCategories('u1', WS), 'FORBIDDEN')
    })
  })

  describe('listRelated()', () => {
    it('lists related articles with the reader audience', async () => {
      actAs('agent')
      repo.findById.mockResolvedValue(ok(draft))
      repo.listRelated.mockResolvedValue(ok([portal]))
      const rows = expectOk(
        await SdKbArticleService.listRelated('u1', WS, 'a1'),
      )
      expect(rows.map((r) => r.id)).toEqual(['a2'])
      expect(repo.listRelated).toHaveBeenCalledWith(draft, {
        portalOnly: false,
        limit: 5,
      })
    })

    it('propagates failures', async () => {
      actAs('non-member')
      expectErr(
        await SdKbArticleService.listRelated('u1', WS, 'a1'),
        'FORBIDDEN',
      )
      actAs('requester')
      repo.findById.mockResolvedValue(ok(draft))
      expectErr(
        await SdKbArticleService.listRelated('u1', WS, 'a1'),
        'SD_KB_ARTICLE_NOT_FOUND',
      )
      repo.findById.mockResolvedValue(ok(portal))
      repo.listRelated.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbArticleService.listRelated('u1', WS, 'a2'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('recordView()', () => {
    beforeEach(() => actAs('requester'))

    it('counts the first view of the day', async () => {
      repo.findById.mockResolvedValue(ok(portal))
      cache.markViewed.mockResolvedValue(true)
      repo.incrementViews.mockResolvedValue(ok(8))
      expect(
        expectOk(await SdKbArticleService.recordView('u1', WS, 'a2')),
      ).toEqual({ viewCount: 8, counted: true })
    })

    it('does not count repeated views or archived articles', async () => {
      repo.findById.mockResolvedValue(ok({ ...portal, viewCount: 4 }))
      cache.markViewed.mockResolvedValue(false)
      expect(
        expectOk(await SdKbArticleService.recordView('u1', WS, 'a2')),
      ).toEqual({ viewCount: 4, counted: false })

      actAs('agent')
      repo.findById.mockResolvedValue(
        ok({ ...draft, viewCount: 2, archivedAt: new Date() }),
      )
      expect(
        expectOk(await SdKbArticleService.recordView('u1', WS, 'a1')),
      ).toEqual({ viewCount: 2, counted: false })
      expect(repo.incrementViews).not.toHaveBeenCalled()
    })

    it('propagates failures', async () => {
      repo.findById.mockResolvedValue(ok(draft))
      expectErr(
        await SdKbArticleService.recordView('u1', WS, 'a1'),
        'SD_KB_ARTICLE_NOT_FOUND',
      )
      repo.findById.mockResolvedValue(ok(portal))
      cache.markViewed.mockResolvedValue(true)
      repo.incrementViews.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbArticleService.recordView('u1', WS, 'a2'),
        'DATABASE_ERROR',
      )
      actAs('non-member')
      expectErr(
        await SdKbArticleService.recordView('u1', WS, 'a2'),
        'FORBIDDEN',
      )
    })
  })

  describe('vote()', () => {
    beforeEach(() => {
      actAs('requester')
      repo.findById.mockResolvedValue(ok(portal))
    })

    it('adds a first helpful vote', async () => {
      cache.swapVote.mockResolvedValue(null)
      repo.applyVoteDelta.mockResolvedValue(
        ok({ helpfulCount: 4, notHelpfulCount: 1 }),
      )
      expect(
        expectOk(
          await SdKbArticleService.vote('u1', WS, 'a2', { helpful: true }),
        ),
      ).toEqual({ helpfulCount: 4, notHelpfulCount: 1, myVote: 'up' })
      expect(repo.applyVoteDelta).toHaveBeenCalledWith('a2', {
        helpful: 1,
        notHelpful: 0,
      })
    })

    it('switches a vote and removes it', async () => {
      cache.swapVote.mockResolvedValueOnce('up')
      repo.applyVoteDelta.mockResolvedValue(
        ok({ helpfulCount: 2, notHelpfulCount: 2 }),
      )
      expectOk(
        await SdKbArticleService.vote('u1', WS, 'a2', { helpful: false }),
      )
      expect(repo.applyVoteDelta).toHaveBeenLastCalledWith('a2', {
        helpful: -1,
        notHelpful: 1,
      })

      cache.swapVote.mockResolvedValueOnce('down')
      const removed = expectOk(
        await SdKbArticleService.vote('u1', WS, 'a2', { helpful: null }),
      )
      expect(removed.myVote).toBeNull()
      expect(repo.applyVoteDelta).toHaveBeenLastCalledWith('a2', {
        helpful: 0,
        notHelpful: -1,
      })
    })

    it('keeps the counters when the vote did not change', async () => {
      cache.swapVote.mockResolvedValue('up')
      expect(
        expectOk(
          await SdKbArticleService.vote('u1', WS, 'a2', { helpful: true }),
        ),
      ).toEqual({ helpfulCount: 3, notHelpfulCount: 1, myVote: 'up' })
      expect(repo.applyVoteDelta).not.toHaveBeenCalled()
    })

    it('fails when Redis is down and reverts the swap on a DB error', async () => {
      cache.swapVote.mockResolvedValueOnce(undefined)
      expectErr(
        await SdKbArticleService.vote('u1', WS, 'a2', { helpful: true }),
        'STORAGE_ERROR',
      )

      cache.swapVote.mockResolvedValueOnce(null)
      repo.applyVoteDelta.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbArticleService.vote('u1', WS, 'a2', { helpful: true }),
        'DATABASE_ERROR',
      )
      expect(cache.swapVote).toHaveBeenLastCalledWith('a2', 'u1', null)
    })

    it('refuses votes on articles the reader cannot see', async () => {
      repo.findById.mockResolvedValue(ok(draft))
      expectErr(
        await SdKbArticleService.vote('u1', WS, 'a1', { helpful: true }),
        'SD_KB_ARTICLE_NOT_FOUND',
      )
      actAs('non-member')
      expectErr(
        await SdKbArticleService.vote('u1', WS, 'a1', { helpful: true }),
        'FORBIDDEN',
      )
    })
  })

  describe('listMentionableMembers()', () => {
    it('lists members for agents', async () => {
      actAs('agent')
      catalog.listMembers.mockResolvedValue(
        ok([{ userId: 'u2', name: 'Ana', image: null }]),
      )
      expect(
        expectOk(
          await SdKbArticleService.listMentionableMembers('u1', WS, 'an'),
        ),
      ).toEqual([{ userId: 'u2', name: 'Ana', image: null }])
      expect(catalog.listMembers).toHaveBeenCalledWith(WS, 'an')
    })
  })
})
