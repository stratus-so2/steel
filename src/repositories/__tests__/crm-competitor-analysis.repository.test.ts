import { describe, expect, it, vi } from 'vitest'
import { seedCrmCompetitor } from '@/src/__tests__/factories/crm-competitor.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import type { DiscoveredPost } from '@/src/lib/social/discovery'
import { CrmCompetitorAnalysisRepository } from '../crm-competitor-analysis.repository'

function discovered(overrides: Partial<DiscoveredPost> = {}): DiscoveredPost {
  return {
    externalId: 'm1',
    format: 'REELS',
    caption: 'Legenda #fibra',
    permalink: 'https://instagram.com/p/m1',
    likeCount: 10,
    commentsCount: 2,
    viewCount: null,
    publishedAt: new Date('2026-10-01T10:00:00Z'),
    ...overrides,
  }
}

async function seedConnection(workspaceId: string, createdById: string) {
  return prisma.crmSocialConnection.create({
    data: {
      platform: 'INSTAGRAM',
      externalAccountId: 'ig-own',
      workspaceId,
      createdById,
    },
  })
}

describe('CrmCompetitorAnalysisRepository', () => {
  describe('upsertCompetitorPosts()', () => {
    it('should insert new posts and refresh counts of known ones', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const competitor = await seedCrmCompetitor(workspace.id, user.id)

      expectOk(
        await CrmCompetitorAnalysisRepository.upsertCompetitorPosts(
          competitor.id,
          [discovered(), discovered({ externalId: 'm2' })],
        ),
      )
      expectOk(
        await CrmCompetitorAnalysisRepository.upsertCompetitorPosts(
          competitor.id,
          [discovered({ likeCount: 99 })],
        ),
      )

      const rows = await prisma.crmCompetitorPost.findMany({
        where: { competitorId: competitor.id },
        orderBy: { externalId: 'asc' },
      })
      expect(rows).toHaveLength(2)
      expect(rows[0]).toMatchObject({ externalId: 'm1', likeCount: 99 })
    })
  })

  describe('listCompetitorPostsSince()', () => {
    it('should return posts inside the window, newest first', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const competitor = await seedCrmCompetitor(workspace.id, user.id)
      await CrmCompetitorAnalysisRepository.upsertCompetitorPosts(
        competitor.id,
        [
          discovered({
            externalId: 'old',
            publishedAt: new Date('2026-08-01T00:00:00Z'),
          }),
          discovered({
            externalId: 'a',
            publishedAt: new Date('2026-10-01T00:00:00Z'),
          }),
          discovered({
            externalId: 'b',
            publishedAt: new Date('2026-10-02T00:00:00Z'),
          }),
        ],
      )

      const posts = expectOk(
        await CrmCompetitorAnalysisRepository.listCompetitorPostsSince(
          competitor.id,
          new Date('2026-09-01T00:00:00Z'),
        ),
      )
      expect(posts.map((p) => p.externalId)).toEqual(['b', 'a'])
    })
  })

  describe('connection posts', () => {
    it('should upsert and list own-account posts', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const connection = await seedConnection(workspace.id, user.id)

      expectOk(
        await CrmCompetitorAnalysisRepository.upsertConnectionPosts(
          connection.id,
          [discovered(), discovered({ commentsCount: 7 })],
        ),
      )

      const posts = expectOk(
        await CrmCompetitorAnalysisRepository.listConnectionPostsSince(
          connection.id,
          new Date('2026-09-01T00:00:00Z'),
        ),
      )
      expect(posts).toHaveLength(1)
      expect(posts[0].commentsCount).toBe(7)
    })
  })

  describe('idea sets', () => {
    it('should return null before any generation and the latest afterwards', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const competitor = await seedCrmCompetitor(workspace.id, user.id)

      expect(
        expectOk(
          await CrmCompetitorAnalysisRepository.findLatestIdeaSet(
            competitor.id,
          ),
        ),
      ).toBeNull()

      expectOk(
        await CrmCompetitorAnalysisRepository.createIdeaSet({
          competitorId: competitor.id,
          range: '30d',
          ideas: [{ title: 'first' }],
          modelKey: 'openai:gpt',
          createdById: user.id,
        }),
      )
      await new Promise((resolve) => setTimeout(resolve, 5))
      const second = expectOk(
        await CrmCompetitorAnalysisRepository.createIdeaSet({
          competitorId: competitor.id,
          range: '7d',
          ideas: [{ title: 'second' }],
          modelKey: 'openai:gpt',
          createdById: user.id,
        }),
      )

      const latest = expectOk(
        await CrmCompetitorAnalysisRepository.findLatestIdeaSet(competitor.id),
      )
      expect(latest?.id).toBe(second.id)
    })

    it('should keep the idea set when its author is deleted', async () => {
      const [workspace, owner, author] = await Promise.all([
        seedWorkspace(),
        seedUser(),
        seedUser(),
      ])
      const competitor = await seedCrmCompetitor(workspace.id, owner.id)
      const set = expectOk(
        await CrmCompetitorAnalysisRepository.createIdeaSet({
          competitorId: competitor.id,
          range: '30d',
          ideas: [],
          modelKey: 'openai:gpt',
          createdById: author.id,
        }),
      )

      await prisma.user.delete({ where: { id: author.id } })

      const row = await prisma.crmCompetitorIdeaSet.findUnique({
        where: { id: set.id },
      })
      expect(row?.createdById).toBeNull()
    })
  })

  describe('database failures', () => {
    it('should wrap Prisma errors in a Result', async () => {
      const results = await Promise.all([
        CrmCompetitorAnalysisRepository.upsertCompetitorPosts('missing', [
          discovered(),
        ]),
        CrmCompetitorAnalysisRepository.upsertConnectionPosts('missing', [
          discovered(),
        ]),
        CrmCompetitorAnalysisRepository.createIdeaSet({
          competitorId: 'missing',
          range: '30d',
          ideas: [],
          modelKey: 'x',
          createdById: 'missing',
        }),
      ])
      for (const result of results) {
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.error.code).toBe('DATABASE_ERROR')
      }
    })

    it('should wrap read failures in a Result', async () => {
      const boom = new Error('connection lost')
      const spies = [
        vi.spyOn(prisma.crmCompetitorPost, 'findMany').mockRejectedValue(boom),
        vi
          .spyOn(prisma.crmSocialConnectionPost, 'findMany')
          .mockRejectedValue(boom),
        vi
          .spyOn(prisma.crmCompetitorIdeaSet, 'findFirst')
          .mockRejectedValue(boom),
      ]
      const since = new Date()
      const results = await Promise.all([
        CrmCompetitorAnalysisRepository.listCompetitorPostsSince('c', since),
        CrmCompetitorAnalysisRepository.listConnectionPostsSince('c', since),
        CrmCompetitorAnalysisRepository.findLatestIdeaSet('c'),
      ])
      for (const spy of spies) spy.mockRestore()
      for (const result of results) {
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.error.code).toBe('DATABASE_ERROR')
      }
    })
  })
})
