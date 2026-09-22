import { describe, expect, it, vi } from 'vitest'
import { seedMembership } from '@/src/__tests__/factories/membership.factory'
import {
  seedSdCategory,
  seedSdKbArticle,
} from '@/src/__tests__/factories/sd-kb.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdKbCatalogRepository } from '../sd-kb-catalog.repository'

describe('SdKbCatalogRepository', () => {
  describe('findCategory()', () => {
    it('finds an active category of the workspace', async () => {
      const ws = await seedWorkspace()
      const category = await seedSdCategory(ws.id)
      expect(
        expectOk(await SdKbCatalogRepository.findCategory(category.id, ws.id)),
      ).toEqual({ id: category.id, name: category.name })
    })

    it('rejects inactive or cross-workspace categories', async () => {
      const [a, b] = await Promise.all([seedWorkspace(), seedWorkspace()])
      const inactive = await seedSdCategory(a.id, { active: false })
      const other = await seedSdCategory(b.id)
      expectErr(
        await SdKbCatalogRepository.findCategory(inactive.id, a.id),
        'SD_CATEGORY_NOT_FOUND',
      )
      expectErr(
        await SdKbCatalogRepository.findCategory(other.id, a.id),
        'SD_CATEGORY_NOT_FOUND',
      )
    })
  })

  describe('listCategoriesWithCounts()', () => {
    it('counts live articles per category for agents', async () => {
      const ws = await seedWorkspace()
      const withArticles = await seedSdCategory(ws.id, { name: 'A' })
      const empty = await seedSdCategory(ws.id, { name: 'B' })
      await seedSdCategory(ws.id, { name: 'C', active: false })
      await seedSdKbArticle(ws.id, { categoryId: withArticles.id })
      await seedSdKbArticle(ws.id, { categoryId: withArticles.id })
      await seedSdKbArticle(ws.id, {
        categoryId: withArticles.id,
        archivedAt: new Date(),
      })

      const rows = expectOk(
        await SdKbCatalogRepository.listCategoriesWithCounts(ws.id, false),
      )
      expect(rows.map((r) => [r.id, r.articleCount])).toEqual([
        [withArticles.id, 2],
        [empty.id, 0],
      ])
    })

    it('keeps only portal categories and portal articles for requesters', async () => {
      const ws = await seedWorkspace()
      const visible = await seedSdCategory(ws.id, { name: 'A' })
      await seedSdCategory(ws.id, { name: 'B', portalVisible: false })
      await seedSdKbArticle(ws.id, {
        categoryId: visible.id,
        status: 'PUBLISHED',
        visibility: 'PORTAL',
      })
      await seedSdKbArticle(ws.id, { categoryId: visible.id })

      const rows = expectOk(
        await SdKbCatalogRepository.listCategoriesWithCounts(ws.id, true),
      )
      expect(rows.map((r) => [r.id, r.articleCount])).toEqual([[visible.id, 1]])
    })
  })

  describe('listMembers()', () => {
    it('lists workspace members filtered by name', async () => {
      const ws = await seedWorkspace()
      const [ana, bruno, outsider] = await Promise.all([
        seedUser({ name: 'Ana Souza' }),
        seedUser({ name: 'Bruno Lima' }),
        seedUser({ name: 'Ana Fora' }),
      ])
      await seedMembership({ userId: ana.id, workspaceId: ws.id })
      await seedMembership({ userId: bruno.id, workspaceId: ws.id })

      const all = expectOk(await SdKbCatalogRepository.listMembers(ws.id, ''))
      expect(all.map((m) => m.name)).toEqual(['Ana Souza', 'Bruno Lima'])

      const filtered = expectOk(
        await SdKbCatalogRepository.listMembers(ws.id, 'ana'),
      )
      expect(filtered).toEqual([
        { userId: ana.id, name: 'Ana Souza', image: null },
      ])
      expect(filtered.some((m) => m.userId === outsider.id)).toBe(false)
    })
  })

  it('maps Prisma failures to DATABASE_ERROR', async () => {
    const boom = () => Promise.reject(new Error('boom'))
    const spies = [
      vi
        .spyOn(prisma.sdCategory, 'findFirst')
        .mockImplementation(boom as never),
      vi.spyOn(prisma.sdCategory, 'findMany').mockImplementation(boom as never),
      vi.spyOn(prisma.membership, 'findMany').mockImplementation(boom as never),
    ]
    expectErr(
      await SdKbCatalogRepository.findCategory('c', 'w'),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdKbCatalogRepository.listCategoriesWithCounts('w', false),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdKbCatalogRepository.listMembers('w', ''),
      'DATABASE_ERROR',
    )
    for (const spy of spies) spy.mockRestore()
  })
})
