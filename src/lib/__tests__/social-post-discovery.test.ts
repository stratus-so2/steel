import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchCompetitorPosts, fetchOwnPosts } from '@/src/lib/social/discovery'
import {
  toInstagramFormat,
  toInstagramPosts,
} from '@/src/lib/social/discovery/instagram'
import {
  parseIsoDurationSeconds,
  toYoutubePosts,
} from '@/src/lib/social/discovery/youtube'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('instagram post parsing', () => {
  it('maps media types to the normalized format', () => {
    expect(
      toInstagramFormat({ media_product_type: 'REELS', media_type: 'VIDEO' }),
    ).toBe('REELS')
    expect(toInstagramFormat({ media_type: 'CAROUSEL_ALBUM' })).toBe('CAROUSEL')
    expect(toInstagramFormat({ media_type: 'VIDEO' })).toBe('VIDEO')
    expect(toInstagramFormat({ media_type: 'IMAGE' })).toBe('IMAGE')
  })

  it('drops stories and malformed items and keeps hidden likes as null', () => {
    const posts = toInstagramPosts([
      {
        id: '1',
        timestamp: '2026-10-01T10:00:00+0000',
        comments_count: 3,
        media_type: 'IMAGE',
      },
      {
        id: '2',
        timestamp: '2026-10-01T10:00:00+0000',
        media_product_type: 'STORY',
      },
      { id: '3' },
      { id: '4', timestamp: 'not-a-date' },
      {
        id: '5',
        timestamp: '2026-10-02T10:00:00+0000',
        like_count: 7,
        caption: 'oi',
        permalink: 'https://ig/p/5',
      },
    ])
    expect(posts.map((p) => p.externalId)).toEqual(['1', '5'])
    expect(posts[0]).toMatchObject({
      likeCount: null,
      commentsCount: 3,
      viewCount: null,
    })
    expect(posts[1]).toMatchObject({
      likeCount: 7,
      commentsCount: null,
      caption: 'oi',
    })
  })
})

describe('youtube post parsing', () => {
  it('parses ISO 8601 durations', () => {
    expect(parseIsoDurationSeconds('PT45S')).toBe(45)
    expect(parseIsoDurationSeconds('PT1H2M3S')).toBe(3723)
    expect(parseIsoDurationSeconds('P1D')).toBe(86_400)
    expect(parseIsoDurationSeconds(undefined)).toBeNull()
    expect(parseIsoDurationSeconds('garbage')).toBeNull()
  })

  it('classifies short videos as SHORT and joins title and description', () => {
    const posts = toYoutubePosts([
      {
        id: 'a',
        snippet: {
          title: 'Título',
          description: 'Desc',
          publishedAt: '2026-10-01T10:00:00Z',
        },
        statistics: { viewCount: '100', likeCount: '5', commentCount: '1' },
        contentDetails: { duration: 'PT30S' },
      },
      {
        id: 'b',
        snippet: { title: 'Longo', publishedAt: '2026-10-01T10:00:00Z' },
        statistics: {},
        contentDetails: { duration: 'PT10M' },
      },
      { id: 'c', snippet: {} },
    ])
    expect(posts).toHaveLength(2)
    expect(posts[0]).toMatchObject({
      format: 'SHORT',
      caption: 'Título\n\nDesc',
      viewCount: 100,
      likeCount: 5,
      commentsCount: 1,
      permalink: 'https://www.youtube.com/watch?v=a',
    })
    expect(posts[1]).toMatchObject({
      format: 'VIDEO',
      likeCount: null,
      viewCount: null,
    })
  })
})

describe('post fetchers', () => {
  it('reads competitor IG posts through Business Discovery', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        business_discovery: {
          media: {
            data: [
              {
                id: 'm1',
                timestamp: '2026-10-01T10:00:00+0000',
                like_count: 2,
              },
            ],
          },
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchCompetitorPosts(
      'INSTAGRAM',
      'tok',
      'ig1',
      '@rival',
    )
    expect(result.ok && result.value.map((p) => p.externalId)).toEqual(['m1'])
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      'business_discovery.username%28rival%29',
    )
  })

  it('returns profile-not-found when Business Discovery has no media', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})))
    const result = await fetchCompetitorPosts(
      'INSTAGRAM',
      'tok',
      'ig1',
      'rival',
    )
    expect(!result.ok && result.error.code).toBe(
      'CRM_COMPETITOR_PROFILE_NOT_FOUND',
    )
  })

  it('reads own IG posts from the media edge', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: [{ id: 'o1', timestamp: '2026-10-01T10:00:00+0000' }],
        }),
      ),
    )
    const result = await fetchOwnPosts('INSTAGRAM', 'tok', 'ig1')
    expect(result.ok && result.value).toHaveLength(1)
  })

  it('walks channel → uploads playlist → videos on YouTube', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ contentDetails: { relatedPlaylists: { uploads: 'UU1' } } }],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ items: [{ contentDetails: { videoId: 'v1' } }] }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: 'v1',
              snippet: { title: 'T', publishedAt: '2026-10-01T10:00:00Z' },
            },
          ],
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchCompetitorPosts(
      'YOUTUBE',
      'tok',
      'ignored',
      'canal',
    )
    expect(result.ok && result.value.map((p) => p.externalId)).toEqual(['v1'])
    expect(String(fetchMock.mock.calls[0][0])).toContain('forHandle=%40canal')
    expect(String(fetchMock.mock.calls[1][0])).toContain('playlistId=UU1')
  })

  it('uses mine=true for the own YouTube channel and stops on an empty playlist', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ contentDetails: { relatedPlaylists: { uploads: 'UU1' } } }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchOwnPosts('YOUTUBE', 'tok', 'ignored')
    expect(result.ok && result.value).toEqual([])
    expect(String(fetchMock.mock.calls[0][0])).toContain('mine=true')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns profile-not-found when the channel has no uploads playlist', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ items: [] })),
    )
    const result = await fetchCompetitorPosts('YOUTUBE', 'tok', 'x', '@nada')
    expect(!result.ok && result.error.code).toBe(
      'CRM_COMPETITOR_PROFILE_NOT_FOUND',
    )
  })

  it('propagates HTTP failures from the YouTube API', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 500)))
    const result = await fetchOwnPosts('YOUTUBE', 'tok', 'x')
    expect(result.ok).toBe(false)
  })
})
