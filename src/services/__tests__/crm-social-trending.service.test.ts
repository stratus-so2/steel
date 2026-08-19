import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmSocialConnection } from '@/src/__tests__/factories/crm-social.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('../crm-social-instagram.service')
vi.mock('../crm-social-token')

import { MembershipRepository } from '@/src/repositories/membership.repository'
import {
  fetchActiveStories,
  fetchEnrichedMediaSince,
} from '../crm-social-instagram.service'
import { getFreshAccessToken } from '../crm-social-token'
import { CrmSocialTrendingService } from '../crm-social-trending.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedGetFreshAccessToken = vi.mocked(getFreshAccessToken)
const mockedFetchEnrichedMediaSince = vi.mocked(fetchEnrichedMediaSince)
const mockedFetchActiveStories = vi.mocked(fetchActiveStories)

describe('CrmSocialTrendingService', () => {
  describe('getTodayRanking()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(
        await CrmSocialTrendingService.getTodayRanking('u1', 'ws1'),
        'FORBIDDEN',
      )
    })

    it('should return an empty ranking when no platform is connected', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedGetFreshAccessToken.mockResolvedValue(
        err({ code: 'CRM_SOCIAL_CONNECTION_NOT_FOUND', message: 'not found' }),
      )

      const items = expectOk(
        await CrmSocialTrendingService.getTodayRanking('u1', 'ws1'),
      )
      expect(items).toEqual([])
    })

    it("should rank today's Instagram posts by engagement velocity", async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      const connection = createFakeCrmSocialConnection({
        externalAccountId: 'ig-1',
      })
      mockedGetFreshAccessToken.mockResolvedValue(
        ok({ accessToken: 'token-1', connection }),
      )
      const now = Date.now()
      mockedFetchEnrichedMediaSince.mockResolvedValue(
        ok([
          {
            id: 'slow',
            mediaType: 'IMAGE',
            mediaUrl: 'https://cdn.example/slow.jpg',
            thumbnailUrl: null,
            caption: 'Devagar',
            timestamp: new Date(now - 10 * 3_600_000).toISOString(),
            permalink: 'https://instagram.com/p/slow',
            likeCount: 100,
            commentsCount: 0,
            saved: 0,
            engagementScore: 100,
          },
          {
            id: 'fast',
            mediaType: 'IMAGE',
            mediaUrl: 'https://cdn.example/fast.jpg',
            thumbnailUrl: 'https://cdn.example/fast-thumb.jpg',
            caption: 'Rápido',
            timestamp: new Date(now - 3_600_000).toISOString(),
            permalink: 'https://instagram.com/p/fast',
            likeCount: 50,
            commentsCount: 10,
            saved: 5,
            engagementScore: 65,
          },
        ]),
      )
      mockedFetchActiveStories.mockResolvedValue(ok([]))

      const items = expectOk(
        await CrmSocialTrendingService.getTodayRanking('u1', 'ws1'),
      )
      expect(items.map((i) => i.id)).toEqual(['fast', 'slow'])
      expect(items[0].platform).toBe('INSTAGRAM')
      expect(items[0].views).toBeNull()
    })

    it('should include active stories, ranked by reach velocity', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      const connection = createFakeCrmSocialConnection({
        externalAccountId: 'ig-1',
      })
      mockedGetFreshAccessToken.mockResolvedValue(
        ok({ accessToken: 'token-1', connection }),
      )
      mockedFetchEnrichedMediaSince.mockResolvedValue(ok([]))
      mockedFetchActiveStories.mockResolvedValue(
        ok([
          {
            id: 'story-1',
            mediaUrl: 'https://cdn.example/story.jpg',
            timestamp: new Date().toISOString(),
            permalink: 'https://instagram.com/stories/story-1',
            reach: 300,
          },
        ]),
      )

      const items = expectOk(
        await CrmSocialTrendingService.getTodayRanking('u1', 'ws1'),
      )
      expect(items).toHaveLength(1)
      expect(items[0]).toMatchObject({
        id: 'story-1',
        platform: 'INSTAGRAM',
        views: 300,
        likes: 0,
        comments: 0,
        saved: null,
      })
    })
  })
})
