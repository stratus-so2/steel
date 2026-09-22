import { describe, expect, it, vi } from 'vitest'
import {
  seedSdCategory,
  seedSdKbArticle,
  seedSdKbComment,
} from '@/src/__tests__/factories/sd-kb.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdKbArticleRepository } from '../sd-kb-article.repository'

const portal = { status: 'PUBLISHED', visibility: 'PORTAL' } as const

describe('SdKbArticleRepository', () => {
  describe('findById()', () => {
    it('returns the article with author and category refs', async () => {
      const [ws, user] = await Promise.all([seedWorkspace(), seedUser()])
      const category = await seedSdCategory(ws.id)
      const seeded = await seedSdKbArticle(ws.id, {
        createdById: user.id,
        categoryId: category.id,
      })

      const found = expectOk(
        await SdKbArticleRepository.findById(seeded.id, ws.id),
      )
      expect(found.createdBy).toMatchObject({ id: user.id, name: user.name })
      expect(found.category).toMatchObject({ id: category.id })
    })

    it('returns SD_KB_ARTICLE_NOT_FOUND for another workspace', async () => {
      const [a, b] = await Promise.all([seedWorkspace(), seedWorkspace()])
      const seeded = await seedSdKbArticle(a.id)
      expectErr(
        await SdKbArticleRepository.findById(seeded.id, b.id),
        'SD_KB_ARTICLE_NOT_FOUND',
      )
    })
  })

  describe('listByWorkspace()', () => {
    it('lists the live tree ordered by parent/position without content', async () => {
      const ws = await seedWorkspace()
      const second = await seedSdKbArticle(ws.id, { position: 1, title: 'B' })
      const first = await seedSdKbArticle(ws.id, { position: 0, title: 'A' })
      await seedSdKbArticle(ws.id, { archivedAt: new Date() })

      const rows = expectOk(
        await SdKbArticleRepository.listByWorkspace(ws.id, {
          archived: false,
          portalOnly: false,
        }),
      )
      expect(rows.map((r) => r.id)).toEqual([first.id, second.id])
      expect(rows[0]).not.toHaveProperty('content')
    })

    it('lists only the archived ones with archived=true', async () => {
      const ws = await seedWorkspace()
      await seedSdKbArticle(ws.id)
      const archived = await seedSdKbArticle(ws.id, { archivedAt: new Date() })
      const rows = expectOk(
        await SdKbArticleRepository.listByWorkspace(ws.id, {
          archived: true,
          portalOnly: false,
        }),
      )
      expect(rows.map((r) => r.id)).toEqual([archived.id])
    })

    it('keeps only published portal articles for requesters', async () => {
      const ws = await seedWorkspace()
      const visible = await seedSdKbArticle(ws.id, portal)
      await seedSdKbArticle(ws.id, { status: 'PUBLISHED' })
      await seedSdKbArticle(ws.id, { visibility: 'PORTAL' })
      const rows = expectOk(
        await SdKbArticleRepository.listByWorkspace(ws.id, {
          archived: false,
          portalOnly: true,
        }),
      )
      expect(rows.map((r) => r.id)).toEqual([visible.id])
    })
  })

  describe('create()', () => {
    it('appends after the live siblings with an empty paragraph', async () => {
      const [ws, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedSdKbArticle(ws.id)
      await seedSdKbArticle(ws.id, { archivedAt: new Date() })

      const created = expectOk(
        await SdKbArticleRepository.create({
          workspaceId: ws.id,
          parentId: null,
          title: 'Novo',
          tags: ['vpn'],
          visibility: 'PORTAL',
          createdById: user.id,
        }),
      )
      expect(created.position).toBe(1)
      expect(created.content).toEqual([{ type: 'p', children: [{ text: '' }] }])
      expect(created.status).toBe('DRAFT')
      expect(created.updatedById).toBe(user.id)
      expect(created.createdBy?.id).toBe(user.id)
    })
  })

  describe('update() and setStatus()', () => {
    it('updates fields and stamps publishedAt only when publishing', async () => {
      const [ws, user] = await Promise.all([seedWorkspace(), seedUser()])
      const seeded = await seedSdKbArticle(ws.id)

      const updated = expectOk(
        await SdKbArticleRepository.update(seeded.id, {
          title: 'Título',
          plainText: 'texto',
          tags: ['a'],
          updatedById: user.id,
        }),
      )
      expect(updated).toMatchObject({ title: 'Título', plainText: 'texto' })

      const published = expectOk(
        await SdKbArticleRepository.setStatus(seeded.id, 'PUBLISHED', user.id),
      )
      expect(published.status).toBe('PUBLISHED')
      expect(published.publishedAt).toBeInstanceOf(Date)

      const draft = expectOk(
        await SdKbArticleRepository.setStatus(seeded.id, 'DRAFT', user.id),
      )
      expect(draft.status).toBe('DRAFT')
      expect(draft.publishedAt).toEqual(published.publishedAt)
    })
  })

  describe('tree walks', () => {
    it('lists ancestors up to the root and the whole subtree', async () => {
      const ws = await seedWorkspace()
      const root = await seedSdKbArticle(ws.id)
      const child = await seedSdKbArticle(ws.id, { parentId: root.id })
      const grandchild = await seedSdKbArticle(ws.id, { parentId: child.id })

      expect(
        expectOk(
          await SdKbArticleRepository.listAncestorIds(grandchild.id, ws.id),
        ),
      ).toEqual([child.id, root.id])
      expect(
        expectOk(await SdKbArticleRepository.listAncestorIds(root.id, ws.id)),
      ).toEqual([])
      expect(
        expectOk(await SdKbArticleRepository.listSubtreeIds(root.id)).sort(),
      ).toEqual([root.id, child.id, grandchild.id].sort())
    })
  })

  describe('move()', () => {
    it('inserts at the position and renumbers the siblings densely', async () => {
      const [ws, user] = await Promise.all([seedWorkspace(), seedUser()])
      const parent = await seedSdKbArticle(ws.id, { position: 0 })
      const a = await seedSdKbArticle(ws.id, {
        parentId: parent.id,
        position: 0,
      })
      const b = await seedSdKbArticle(ws.id, {
        parentId: parent.id,
        position: 1,
      })
      const moving = await seedSdKbArticle(ws.id, { position: 1 })

      const moved = expectOk(
        await SdKbArticleRepository.move(moving.id, ws.id, {
          parentId: parent.id,
          position: 1,
          updatedById: user.id,
        }),
      )
      expect(moved).toMatchObject({ parentId: parent.id, position: 1 })
      const siblings = await prisma.sdKbArticle.findMany({
        where: { parentId: parent.id },
        orderBy: { position: 'asc' },
      })
      expect(siblings.map((s) => s.id)).toEqual([a.id, moving.id, b.id])
      expect(siblings.map((s) => s.position)).toEqual([0, 1, 2])
    })

    it('clamps a position past the end', async () => {
      const [ws, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedSdKbArticle(ws.id, { position: 0 })
      const moving = await seedSdKbArticle(ws.id, { position: 1 })
      const moved = expectOk(
        await SdKbArticleRepository.move(moving.id, ws.id, {
          parentId: null,
          position: 99,
          updatedById: user.id,
        }),
      )
      expect(moved.position).toBe(1)
    })
  })

  describe('archive() and restore()', () => {
    it('archives the subtree together and restores exactly it', async () => {
      const [ws, user] = await Promise.all([seedWorkspace(), seedUser()])
      const root = await seedSdKbArticle(ws.id)
      const child = await seedSdKbArticle(ws.id, { parentId: root.id })
      const grandchild = await seedSdKbArticle(ws.id, { parentId: child.id })
      const earlier = new Date('2026-01-01T00:00:00Z')
      const archivedBefore = await seedSdKbArticle(ws.id, {
        parentId: root.id,
        archivedAt: earlier,
      })

      const archived = expectOk(
        await SdKbArticleRepository.archive(root.id, user.id),
      )
      const stamp = archived.archivedAt
      expect(stamp).toBeInstanceOf(Date)
      const after = await prisma.sdKbArticle.findMany({
        where: { id: { in: [child.id, grandchild.id, archivedBefore.id] } },
      })
      const byId = new Map(after.map((a) => [a.id, a.archivedAt]))
      expect(byId.get(child.id)).toEqual(stamp)
      expect(byId.get(grandchild.id)).toEqual(stamp)
      expect(byId.get(archivedBefore.id)).toEqual(earlier)

      const restored = expectOk(
        await SdKbArticleRepository.restore(root.id, user.id),
      )
      expect(restored.archivedAt).toBeNull()
      const back = await prisma.sdKbArticle.findMany({
        where: { id: { in: [child.id, grandchild.id, archivedBefore.id] } },
      })
      const restoredById = new Map(back.map((a) => [a.id, a.archivedAt]))
      expect(restoredById.get(child.id)).toBeNull()
      expect(restoredById.get(grandchild.id)).toBeNull()
      expect(restoredById.get(archivedBefore.id)).toEqual(earlier)
    })

    it('moves a restored article to the root when its parent is still archived', async () => {
      const [ws, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedSdKbArticle(ws.id)
      const parent = await seedSdKbArticle(ws.id)
      const child = await seedSdKbArticle(ws.id, { parentId: parent.id })
      expectOk(await SdKbArticleRepository.archive(parent.id, user.id))

      const restored = expectOk(
        await SdKbArticleRepository.restore(child.id, user.id),
      )
      expect(restored).toMatchObject({ parentId: null, archivedAt: null })
      expect(restored.position).toBe(1)
    })
  })

  describe('delete()', () => {
    it('removes the article, its subtree and comments', async () => {
      const [ws, user] = await Promise.all([seedWorkspace(), seedUser()])
      const root = await seedSdKbArticle(ws.id)
      const child = await seedSdKbArticle(ws.id, { parentId: root.id })
      await seedSdKbComment(root.id, user.id)

      expectOk(await SdKbArticleRepository.delete(root.id))
      expect(
        await prisma.sdKbArticle.count({
          where: { id: { in: [root.id, child.id] } },
        }),
      ).toBe(0)
      expect(await prisma.sdKbComment.count()).toBe(0)
    })
  })

  describe('engagement counters', () => {
    it('increments views and applies vote deltas without going negative', async () => {
      const ws = await seedWorkspace()
      const seeded = await seedSdKbArticle(ws.id, { helpfulCount: 1 })

      expect(
        expectOk(await SdKbArticleRepository.incrementViews(seeded.id)),
      ).toBe(1)
      expect(
        expectOk(
          await SdKbArticleRepository.applyVoteDelta(seeded.id, {
            helpful: -1,
            notHelpful: 1,
          }),
        ),
      ).toEqual({ helpfulCount: 0, notHelpfulCount: 1 })
      expect(
        expectOk(
          await SdKbArticleRepository.applyVoteDelta(seeded.id, {
            helpful: -1,
            notHelpful: 0,
          }),
        ),
      ).toEqual({ helpfulCount: 0, notHelpfulCount: 1 })
    })

    it('returns SD_KB_ARTICLE_NOT_FOUND when voting on a missing article', async () => {
      expectErr(
        await SdKbArticleRepository.applyVoteDelta('missing', {
          helpful: 1,
          notHelpful: 0,
        }),
        'SD_KB_ARTICLE_NOT_FOUND',
      )
    })
  })

  describe('search()', () => {
    it('ranks title matches first and matches the body via tsvector', async () => {
      const ws = await seedWorkspace()
      const body = await seedSdKbArticle(ws.id, {
        title: 'Acesso remoto',
        plainText: 'Para configurar a impressora de rede siga os passos',
      })
      const title = await seedSdKbArticle(ws.id, {
        title: 'Impressora não imprime',
        plainText: 'verifique o cabo',
      })
      await seedSdKbArticle(ws.id, { title: 'Outro', plainText: 'nada' })
      await seedSdKbArticle(ws.id, {
        title: 'Impressora arquivada',
        archivedAt: new Date(),
      })

      const rows = expectOk(
        await SdKbArticleRepository.search(ws.id, {
          q: 'impressora',
          limit: 10,
          portalOnly: false,
        }),
      )
      expect(rows.map((r) => r.id)).toEqual([title.id, body.id])
      expect(rows[0]?.rank).toBeGreaterThan(rows[1]?.rank ?? 0)
      expect(rows[1]?.plainText).toContain('impressora')
    })

    it('matches partial words through ILIKE and escapes wildcards', async () => {
      const ws = await seedWorkspace()
      const hit = await seedSdKbArticle(ws.id, { title: 'Configuração 100%' })
      await seedSdKbArticle(ws.id, { title: 'Configuração 1000' })
      const rows = expectOk(
        await SdKbArticleRepository.search(ws.id, {
          q: '100%',
          limit: 10,
          portalOnly: false,
        }),
      )
      expect(rows.map((r) => r.id)).toEqual([hit.id])
    })

    it('applies status, visibility, category, tag and portal filters', async () => {
      const ws = await seedWorkspace()
      const category = await seedSdCategory(ws.id)
      const match = await seedSdKbArticle(ws.id, {
        ...portal,
        categoryId: category.id,
        tags: ['vpn'],
      })
      await seedSdKbArticle(ws.id, { ...portal, tags: ['vpn'] })
      await seedSdKbArticle(ws.id, { categoryId: category.id, tags: ['vpn'] })

      const rows = expectOk(
        await SdKbArticleRepository.search(ws.id, {
          q: '',
          status: 'PUBLISHED',
          visibility: 'PORTAL',
          categoryId: category.id,
          tag: 'vpn',
          limit: 10,
          portalOnly: true,
        }),
      )
      expect(rows.map((r) => r.id)).toEqual([match.id])
      expect(rows[0]?.rank).toBe(0)
    })

    it('returns an empty list when nothing matches', async () => {
      const ws = await seedWorkspace()
      expect(
        expectOk(
          await SdKbArticleRepository.search(ws.id, {
            q: 'inexistente',
            limit: 5,
            portalOnly: false,
          }),
        ),
      ).toEqual([])
    })
  })

  describe('suggest()', () => {
    it('matches any title term or the ticket categories, published only', async () => {
      const ws = await seedWorkspace()
      const category = await seedSdCategory(ws.id)
      const byCategory = await seedSdKbArticle(ws.id, {
        status: 'PUBLISHED',
        categoryId: category.id,
        title: 'Política de acesso',
      })
      const byText = await seedSdKbArticle(ws.id, {
        status: 'PUBLISHED',
        title: 'VPN caiu',
        plainText: 'reinicie o cliente vpn',
      })
      const both = await seedSdKbArticle(ws.id, {
        status: 'PUBLISHED',
        categoryId: category.id,
        title: 'VPN corporativa',
      })
      await seedSdKbArticle(ws.id, { title: 'VPN rascunho' })

      const rows = expectOk(
        await SdKbArticleRepository.suggest(ws.id, {
          terms: ['vpn', 'lenta'],
          categoryIds: [category.id],
          limit: 10,
          portalOnly: false,
        }),
      )
      expect(rows.map((r) => r.id)[0]).toBe(both.id)
      expect(rows.map((r) => r.id).sort()).toEqual(
        [both.id, byCategory.id, byText.id].sort(),
      )
    })

    it('filters portal visibility, works with only terms or only categories', async () => {
      const ws = await seedWorkspace()
      const category = await seedSdCategory(ws.id)
      const visible = await seedSdKbArticle(ws.id, {
        ...portal,
        title: 'Senha expirada',
        categoryId: category.id,
      })
      await seedSdKbArticle(ws.id, {
        status: 'PUBLISHED',
        title: 'Senha interna',
      })

      const byTerms = expectOk(
        await SdKbArticleRepository.suggest(ws.id, {
          terms: ['senha'],
          categoryIds: [],
          limit: 5,
          portalOnly: true,
        }),
      )
      expect(byTerms.map((r) => r.id)).toEqual([visible.id])

      const byCategory = expectOk(
        await SdKbArticleRepository.suggest(ws.id, {
          terms: [],
          categoryIds: [category.id],
          limit: 5,
          portalOnly: false,
        }),
      )
      expect(byCategory.map((r) => r.id)).toEqual([visible.id])
    })

    it('returns nothing without terms and categories or without matches', async () => {
      const ws = await seedWorkspace()
      expect(
        expectOk(
          await SdKbArticleRepository.suggest(ws.id, {
            terms: [],
            categoryIds: [],
            limit: 5,
            portalOnly: false,
          }),
        ),
      ).toEqual([])
      expect(
        expectOk(
          await SdKbArticleRepository.suggest(ws.id, {
            terms: ['zzz'],
            categoryIds: [],
            limit: 5,
            portalOnly: false,
          }),
        ),
      ).toEqual([])
    })
  })

  describe('listRelated()', () => {
    it('finds live articles sharing the category or a tag', async () => {
      const ws = await seedWorkspace()
      const category = await seedSdCategory(ws.id)
      const article = await seedSdKbArticle(ws.id, {
        categoryId: category.id,
        tags: ['vpn'],
      })
      const sameCategory = await seedSdKbArticle(ws.id, {
        categoryId: category.id,
        helpfulCount: 5,
      })
      const sameTag = await seedSdKbArticle(ws.id, { tags: ['vpn', 'rede'] })
      await seedSdKbArticle(ws.id, { tags: ['outra'] })
      await seedSdKbArticle(ws.id, {
        categoryId: category.id,
        archivedAt: new Date(),
      })

      const rows = expectOk(
        await SdKbArticleRepository.listRelated(article, {
          portalOnly: false,
          limit: 5,
        }),
      )
      expect(rows.map((r) => r.id)).toEqual([sameCategory.id, sameTag.id])

      const portalRows = expectOk(
        await SdKbArticleRepository.listRelated(article, {
          portalOnly: true,
          limit: 5,
        }),
      )
      expect(portalRows).toEqual([])
    })

    it('returns [] for an article without category and tags', async () => {
      const ws = await seedWorkspace()
      const article = await seedSdKbArticle(ws.id)
      expect(
        expectOk(
          await SdKbArticleRepository.listRelated(article, {
            portalOnly: false,
            limit: 5,
          }),
        ),
      ).toEqual([])
    })
  })

  describe('database failures', () => {
    it('maps thrown Prisma errors to DATABASE_ERROR', async () => {
      const boom = () => Promise.reject(new Error('boom'))
      const spies = [
        vi
          .spyOn(prisma.sdKbArticle, 'findFirst')
          .mockImplementation(boom as never),
        vi
          .spyOn(prisma.sdKbArticle, 'findMany')
          .mockImplementation(boom as never),
        vi.spyOn(prisma.sdKbArticle, 'count').mockImplementation(boom as never),
        vi
          .spyOn(prisma.sdKbArticle, 'update')
          .mockImplementation(boom as never),
        vi
          .spyOn(prisma.sdKbArticle, 'delete')
          .mockImplementation(boom as never),
        vi.spyOn(prisma, '$transaction').mockImplementation(boom as never),
        vi.spyOn(prisma, '$queryRaw').mockImplementation(boom as never),
      ]
      const audience = { portalOnly: false }
      expectErr(
        await SdKbArticleRepository.findById('a', 'w'),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdKbArticleRepository.listByWorkspace('w', {
          ...audience,
          archived: false,
        }),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdKbArticleRepository.create({
          workspaceId: 'w',
          parentId: null,
          title: '',
          createdById: 'u',
        }),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdKbArticleRepository.update('a', { updatedById: 'u' }),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdKbArticleRepository.setStatus('a', 'DRAFT', 'u'),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdKbArticleRepository.listAncestorIds('a', 'w'),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdKbArticleRepository.listSubtreeIds('a'),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdKbArticleRepository.move('a', 'w', {
          parentId: null,
          position: 0,
          updatedById: 'u',
        }),
        'DATABASE_ERROR',
      )
      expectErr(await SdKbArticleRepository.archive('a', 'u'), 'DATABASE_ERROR')
      expectErr(await SdKbArticleRepository.restore('a', 'u'), 'DATABASE_ERROR')
      expectErr(await SdKbArticleRepository.delete('a'), 'DATABASE_ERROR')
      expectErr(
        await SdKbArticleRepository.incrementViews('a'),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdKbArticleRepository.applyVoteDelta('a', {
          helpful: 1,
          notHelpful: 0,
        }),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdKbArticleRepository.search('w', {
          ...audience,
          q: 'x',
          limit: 5,
        }),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdKbArticleRepository.suggest('w', {
          ...audience,
          terms: ['x'],
          categoryIds: [],
          limit: 5,
        }),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdKbArticleRepository.listRelated(
          { id: 'a', workspaceId: 'w', categoryId: 'c', tags: [] },
          { ...audience, limit: 5 },
        ),
        'DATABASE_ERROR',
      )
      for (const spy of spies) spy.mockRestore()
    })
  })
})
