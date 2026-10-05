import { describe, expect, it } from 'vitest'
import {
  buildCompetitorInsights,
  computePostStats,
  daypartOf,
  extractHashtags,
  interactionsOf,
  type PostSample,
  toSocialPostDTO,
  zonedWeekdayAndHour,
} from '@/src/lib/social/post-analytics'

let seq = 0
function post(overrides: Partial<PostSample> = {}): PostSample {
  seq += 1
  return {
    externalId: `p${seq}`,
    format: 'IMAGE',
    caption: null,
    permalink: null,
    likeCount: 10,
    commentsCount: 0,
    viewCount: null,
    // Monday 2026-10-05 12:00 in São Paulo (UTC-3).
    publishedAt: new Date('2026-10-05T15:00:00Z'),
    ...overrides,
  }
}

describe('post-analytics', () => {
  describe('zonedWeekdayAndHour()', () => {
    it('reads weekday and hour in the São Paulo timezone', () => {
      expect(zonedWeekdayAndHour(new Date('2026-10-05T15:00:00Z'))).toEqual({
        weekday: 1,
        hour: 12,
      })
      // 01:30 UTC on Monday is still Sunday 22:30 in São Paulo.
      expect(zonedWeekdayAndHour(new Date('2026-10-05T01:30:00Z'))).toEqual({
        weekday: 0,
        hour: 22,
      })
    })
  })

  describe('daypartOf()', () => {
    it('splits the day in four blocks of six hours', () => {
      expect(daypartOf(0)).toBe('DAWN')
      expect(daypartOf(6)).toBe('MORNING')
      expect(daypartOf(12)).toBe('AFTERNOON')
      expect(daypartOf(18)).toBe('EVENING')
      expect(daypartOf(23)).toBe('EVENING')
    })
  })

  describe('interactionsOf()', () => {
    it('sums likes and comments, treating a single hidden count as zero', () => {
      expect(interactionsOf(post({ likeCount: 3, commentsCount: 2 }))).toBe(5)
      expect(interactionsOf(post({ likeCount: null, commentsCount: 2 }))).toBe(
        2,
      )
    })

    it('returns null when the platform reported neither count', () => {
      expect(
        interactionsOf(post({ likeCount: null, commentsCount: null })),
      ).toBeNull()
    })
  })

  describe('extractHashtags()', () => {
    it('extracts unique lowercased hashtags, accents included', () => {
      expect(
        extractHashtags('Promo #Telecom #fibra_óptica e #telecom de novo'),
      ).toEqual(['telecom', 'fibra_óptica'])
    })

    it('returns an empty list without a caption', () => {
      expect(extractHashtags(null)).toEqual([])
    })
  })

  describe('toSocialPostDTO()', () => {
    it('serializes the date and adds interactions', () => {
      const dto = toSocialPostDTO(post({ likeCount: 4, commentsCount: 1 }))
      expect(dto.interactions).toBe(5)
      expect(dto.publishedAt).toBe('2026-10-05T15:00:00.000Z')
    })
  })

  describe('computePostStats()', () => {
    it('returns zeroed stats for an empty window', () => {
      const stats = computePostStats([], { followersCount: 100, rangeDays: 30 })
      expect(stats.postsCount).toBe(0)
      expect(stats.postsPerWeek).toBe(0)
      expect(stats.avgInteractions).toBeNull()
      expect(stats.engagementRate).toBeNull()
      expect(stats.formats).toEqual([])
      expect(stats.weekdays).toHaveLength(7)
      expect(stats.dayparts).toHaveLength(4)
      expect(stats.topPosts).toEqual([])
    })

    it('computes frequency, averages and engagement rate', () => {
      const stats = computePostStats(
        [
          post({ likeCount: 90, commentsCount: 10, caption: 'abcd' }),
          post({ likeCount: 40, commentsCount: 10, caption: 'ab' }),
        ],
        { followersCount: 1000, rangeDays: 7 },
      )
      expect(stats.postsCount).toBe(2)
      expect(stats.postsPerWeek).toBe(2)
      expect(stats.avgInteractions).toBe(75)
      expect(stats.engagementRate).toBe(7.5)
      expect(stats.avgCaptionLength).toBe(3)
    })

    it('leaves the engagement rate empty without followers', () => {
      const stats = computePostStats([post()], {
        followersCount: null,
        rangeDays: 7,
      })
      expect(stats.engagementRate).toBeNull()
    })

    it('counts hidden likes and averages views', () => {
      const stats = computePostStats(
        [
          post({ likeCount: null, commentsCount: 4, viewCount: 100 }),
          post({ viewCount: 300 }),
        ],
        { followersCount: 10, rangeDays: 30 },
      )
      expect(stats.hiddenLikesCount).toBe(1)
      expect(stats.avgViews).toBe(200)
    })

    it('groups by format with share, sorted by volume', () => {
      const stats = computePostStats(
        [
          post({ format: 'REELS', likeCount: 100 }),
          post({ format: 'REELS', likeCount: 50 }),
          post({ format: 'IMAGE', likeCount: 10 }),
        ],
        { followersCount: null, rangeDays: 30 },
      )
      expect(stats.formats[0]).toMatchObject({
        format: 'REELS',
        postsCount: 2,
        avgInteractions: 75,
      })
      expect(stats.formats[0].share).toBeCloseTo(66.7, 1)
      expect(stats.formats[1]).toMatchObject({ format: 'IMAGE', postsCount: 1 })
    })

    it('buckets by weekday and daypart', () => {
      const stats = computePostStats(
        [
          post({ publishedAt: new Date('2026-10-05T15:00:00Z') }),
          post({ publishedAt: new Date('2026-10-05T01:30:00Z') }),
        ],
        { followersCount: null, rangeDays: 30 },
      )
      expect(stats.weekdays[1].postsCount).toBe(1)
      expect(stats.weekdays[0].postsCount).toBe(1)
      const afternoon = stats.dayparts.find((d) => d.daypart === 'AFTERNOON')
      const evening = stats.dayparts.find((d) => d.daypart === 'EVENING')
      expect(afternoon?.postsCount).toBe(1)
      expect(evening?.postsCount).toBe(1)
    })

    it('ranks hashtags by count, then by average interactions', () => {
      const stats = computePostStats(
        [
          post({ caption: '#a #b', likeCount: 1 }),
          post({ caption: '#a #c', likeCount: 50 }),
          post({ caption: '#c', likeCount: 50 }),
          post({ caption: '#b', likeCount: 1 }),
        ],
        { followersCount: null, rangeDays: 30 },
      )
      expect(stats.hashtags.map((h) => h.tag)).toEqual(['c', 'a', 'b'])
    })

    it('keeps the top five posts, falling back to views for ranking', () => {
      const posts = [
        post({
          externalId: 'views',
          likeCount: null,
          commentsCount: null,
          viewCount: 999,
        }),
        ...[1, 2, 3, 4, 5].map((n) =>
          post({ externalId: `n${n}`, likeCount: n, commentsCount: 0 }),
        ),
      ]
      const stats = computePostStats(posts, {
        followersCount: null,
        rangeDays: 30,
      })
      expect(stats.topPosts.map((p) => p.externalId)).toEqual([
        'views',
        'n5',
        'n4',
        'n3',
        'n2',
      ])
    })
  })

  describe('buildCompetitorInsights()', () => {
    const range = { followersCount: 1000, rangeDays: 7 }

    it('returns nothing when the competitor has no posts', () => {
      expect(
        buildCompetitorInsights({
          competitorName: 'Rival',
          competitor: computePostStats([], range),
          own: null,
        }),
      ).toEqual([])
    })

    it('compares frequency and engagement with the own account', () => {
      const competitor = computePostStats(
        [
          post({ likeCount: 10 }),
          post({ likeCount: 10 }),
          post({ likeCount: 10 }),
        ],
        range,
      )
      const own = computePostStats([post({ likeCount: 100 })], range)
      const insights = buildCompetitorInsights({
        competitorName: 'Rival',
        competitor,
        own,
      })
      const frequency = insights.find((i) => i.key === 'frequency')
      const engagement = insights.find((i) => i.key === 'engagement')
      expect(frequency?.tone).toBe('negative')
      expect(frequency?.text).toContain('Rival publica 3 posts/semana')
      expect(engagement?.tone).toBe('positive')
    })

    it('marks equal frequency as neutral and a lead as positive', () => {
      const one = computePostStats([post()], range)
      const three = computePostStats([post(), post(), post()], range)
      expect(
        buildCompetitorInsights({
          competitorName: 'R',
          competitor: one,
          own: one,
        }).find((i) => i.key === 'frequency')?.tone,
      ).toBe('neutral')
      expect(
        buildCompetitorInsights({
          competitorName: 'R',
          competitor: one,
          own: three,
        }).find((i) => i.key === 'frequency')?.tone,
      ).toBe('positive')
    })

    it('flags a strong competitor format the own account does not use', () => {
      const competitor = computePostStats(
        [
          post({ format: 'REELS', likeCount: 100 }),
          post({ format: 'REELS', likeCount: 100 }),
          post({ format: 'IMAGE', likeCount: 10 }),
          post({ format: 'IMAGE', likeCount: 10 }),
        ],
        range,
      )
      const own = computePostStats([post({ format: 'IMAGE' })], range)
      const insight = buildCompetitorInsights({
        competitorName: 'Rival',
        competitor,
        own,
      }).find((i) => i.key === 'best-format')
      expect(insight?.tone).toBe('negative')
      expect(insight?.text).toContain('Reels rende')
      expect(insight?.text).toContain('você não publicou nenhum reels')
    })

    it('describes the best format alone when there is no own account', () => {
      const competitor = computePostStats(
        [
          post({ format: 'CAROUSEL', likeCount: 100 }),
          post({ format: 'CAROUSEL', likeCount: 100 }),
          post({ format: 'IMAGE', likeCount: 10 }),
          post({ format: 'IMAGE', likeCount: 10 }),
        ],
        range,
      )
      const insight = buildCompetitorInsights({
        competitorName: 'Rival',
        competitor,
        own: null,
      }).find((i) => i.key === 'best-format')
      expect(insight?.tone).toBe('neutral')
      expect(insight?.text).toContain('Carrossel é o formato que mais rende')
    })

    it('skips the format insight when the lead is small', () => {
      const competitor = computePostStats(
        [
          post({ format: 'REELS', likeCount: 11 }),
          post({ format: 'REELS', likeCount: 11 }),
          post({ format: 'IMAGE', likeCount: 10 }),
          post({ format: 'IMAGE', likeCount: 10 }),
        ],
        range,
      )
      expect(
        buildCompetitorInsights({
          competitorName: 'Rival',
          competitor,
          own: null,
        }).some((i) => i.key === 'best-format'),
      ).toBe(false)
    })

    it('reports best weekday, daypart and the hashtag gap', () => {
      const competitor = computePostStats(
        [post({ caption: '#fibra #promo' }), post({ caption: '#fibra' })],
        range,
      )
      const own = computePostStats([post({ caption: '#promo' })], range)
      const insights = buildCompetitorInsights({
        competitorName: 'Rival',
        competitor,
        own,
      })
      expect(insights.find((i) => i.key === 'best-weekday')?.text).toBe(
        'Os posts de Rival rendem mais na segunda.',
      )
      expect(insights.find((i) => i.key === 'best-daypart')?.text).toBe(
        'Melhor horário de Rival: à tarde.',
      )
      expect(insights.find((i) => i.key === 'hashtags-gap')?.text).toContain(
        '#fibra',
      )
    })
  })
})
