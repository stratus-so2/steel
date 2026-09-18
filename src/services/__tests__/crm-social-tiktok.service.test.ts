import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  asMember,
  describeSocialAuthz,
  withToken,
} from '@/src/__tests__/helpers/crm-social.helpers'
import {
  headerOf,
  jsonResponse,
  mockFetch,
  textResponse,
  unreadableResponse,
} from '@/src/__tests__/helpers/fetch.helpers'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/services/crm-social-token')

import {
  getOverview,
  getVideos,
  getWeeklyEngagement,
  publishVideo,
  TIKTOK_SINGLE_CHUNK_MAX_BYTES,
} from '../crm-social-tiktok.service'

const API = 'https://open.tiktokapis.com/v2'
const ALL_SCOPES = 'user.info.basic,user.info.stats,video.list,video.publish'
const NOW = new Date('2026-09-18T12:00:00.000Z')

let fetchMock: ReturnType<typeof mockFetch>

const publishInput = {
  title: 'Meu vídeo',
  privacyLevel: 'SELF_ONLY' as const,
  disableComment: true,
  disableDuet: false,
  disableStitch: true,
}

function file(contentType = 'video/quicktime') {
  return { bytes: new Uint8Array(8).buffer, contentType }
}

beforeEach(() => {
  fetchMock = mockFetch(() => {
    throw new Error('unexpected fetch')
  })
  asMember('MEMBER')
  withToken({ scope: ALL_SCOPES, externalAccountId: 'open-1' }, 'tt-token')
})

afterEach(() => {
  vi.useRealTimers()
})

describeSocialAuthz(
  [
    {
      name: 'getOverview()',
      action: 'VIEW',
      scope: 'user.info.stats',
      call: () => getOverview('u1', 'ws1'),
    },
    {
      name: 'getVideos()',
      action: 'VIEW',
      scope: 'video.list',
      call: () => getVideos('u1', 'ws1'),
    },
    {
      name: 'getWeeklyEngagement()',
      action: 'VIEW',
      scope: 'video.list',
      call: () => getWeeklyEngagement('u1', 'ws1'),
    },
    {
      name: 'publishVideo()',
      action: 'CREATE',
      scope: 'video.publish',
      call: () => publishVideo('u1', 'ws1', publishInput, file()),
    },
  ],
  () => fetchMock.spy,
)

it('should cap a single-chunk upload at 64 MiB', () => {
  expect(TIKTOK_SINGLE_CHUNK_MAX_BYTES).toBe(64 * 1024 * 1024)
})

describe('getOverview()', () => {
  it('should read the creator profile and stats', async () => {
    fetchMock = mockFetch(() =>
      jsonResponse({
        data: {
          user: {
            open_id: 'open-1',
            avatar_url: 'https://tt/a.jpg',
            display_name: 'Acme',
            bio_description: 'Bio',
            profile_deep_link: 'https://tiktok.com/@acme',
            is_verified: true,
            follower_count: 1000,
            following_count: '12',
            likes_count: 5000.7,
            video_count: -3,
          },
        },
        error: { code: 'ok', message: '' },
      }),
    )

    expect(expectOk(await getOverview('u1', 'ws1'))).toEqual({
      openId: 'open-1',
      displayName: 'Acme',
      bio: 'Bio',
      avatarUrl: 'https://tt/a.jpg',
      profileLink: 'https://tiktok.com/@acme',
      isVerified: true,
      followerCount: 1000,
      followingCount: 12,
      likesCount: 5000,
      videoCount: 0,
    })
    const [call] = fetchMock.calls()
    const url = new URL(call.url)
    expect(`${url.origin}${url.pathname}`).toBe(`${API}/user/info/`)
    expect(url.searchParams.get('fields')?.split(',')).toContain(
      'follower_count',
    )
    expect(headerOf(call, 'Authorization')).toBe('Bearer tt-token')
  })

  it('should fall back to defaults for an empty user', async () => {
    fetchMock = mockFetch(() => jsonResponse({ data: {} }))

    expect(expectOk(await getOverview('u1', 'ws1'))).toEqual({
      openId: 'unknown',
      displayName: 'Conta TikTok',
      bio: null,
      avatarUrl: null,
      profileLink: null,
      isVerified: false,
      followerCount: 0,
      followingCount: 0,
      likesCount: 0,
      videoCount: 0,
    })
  })

  it('should treat a malformed 200 body as an empty profile', async () => {
    fetchMock = mockFetch(() => textResponse('not json'))
    expect(expectOk(await getOverview('u1', 'ws1')).openId).toBe('unknown')
  })

  it('should fail on a domain error inside a 200 envelope', async () => {
    fetchMock = mockFetch(() =>
      jsonResponse({
        error: { code: 'scope_not_authorized', message: 'no', log_id: 'l1' },
      }),
    )
    expectErr(await getOverview('u1', 'ws1'), 'CRM_SOCIAL_OAUTH_FAILED')
  })

  it('should fail on an HTTP 401 without an error envelope', async () => {
    fetchMock = mockFetch(() => textResponse('', { status: 401 }))
    expectErr(await getOverview('u1', 'ws1'), 'CRM_SOCIAL_OAUTH_FAILED')
  })

  it('should map a network error to CRM_SOCIAL_OAUTH_FAILED', async () => {
    fetchMock = mockFetch(() => {
      throw new TypeError('fetch failed')
    })
    expectErr(await getOverview('u1', 'ws1'), 'CRM_SOCIAL_OAUTH_FAILED')
  })
})

describe('getVideos()', () => {
  it('should POST the listing and map + total the videos', async () => {
    fetchMock = mockFetch(() =>
      jsonResponse({
        data: {
          videos: [
            {
              id: 7123,
              title: 'Título',
              video_description: 'desc',
              duration: 15,
              cover_image_url: 'https://tt/c.jpg',
              share_url: 'https://tt/s',
              embed_link: 'https://tt/e',
              view_count: 100,
              like_count: 10,
              comment_count: 2,
              share_count: 1,
              create_time: 1_758_000_000,
            },
            { video_description: 'Só descrição', view_count: 50 },
            {},
          ],
        },
      }),
    )

    const result = expectOk(await getVideos('u1', 'ws1'))

    expect(result.totals).toEqual({
      views: 150,
      likes: 10,
      comments: 2,
      shares: 1,
    })
    expect(result.videos).toEqual([
      {
        id: '7123',
        title: 'Título',
        coverImageUrl: 'https://tt/c.jpg',
        shareUrl: 'https://tt/s',
        embedLink: 'https://tt/e',
        duration: 15,
        createdAt: new Date(1_758_000_000_000).toISOString(),
        viewCount: 100,
        likeCount: 10,
        commentCount: 2,
        shareCount: 1,
      },
      expect.objectContaining({
        id: '',
        title: 'Só descrição',
        coverImageUrl: null,
        createdAt: '',
        viewCount: 50,
      }),
      expect.objectContaining({ title: 'Sem título', viewCount: 0 }),
    ])
    const [call] = fetchMock.calls()
    expect(call.url.startsWith(`${API}/video/list/?fields=`)).toBe(true)
    expect(call.init?.method).toBe('POST')
    expect(JSON.parse(String(call.init?.body))).toEqual({ max_count: 20 })
  })

  it('should return an empty listing for a malformed 200 body', async () => {
    fetchMock = mockFetch(() => textResponse('<html>'))
    expect(expectOk(await getVideos('u1', 'ws1'))).toEqual({
      totals: { views: 0, likes: 0, comments: 0, shares: 0 },
      videos: [],
    })
  })

  it('should fail on a 429 rate limit', async () => {
    fetchMock = mockFetch(() =>
      jsonResponse({ error: { code: 'rate_limit_exceeded' } }, { status: 429 }),
    )
    expectErr(await getVideos('u1', 'ws1'), 'CRM_SOCIAL_OAUTH_FAILED')
  })

  it('should map a network error to CRM_SOCIAL_OAUTH_FAILED', async () => {
    fetchMock = mockFetch(() => {
      throw new TypeError('fetch failed')
    })
    expectErr(await getVideos('u1', 'ws1'), 'CRM_SOCIAL_OAUTH_FAILED')
  })
})

describe('getWeeklyEngagement()', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })

  function daysAgo(days: number): number {
    return Math.floor((NOW.getTime() - days * 86_400_000) / 1000)
  }

  it('should sum 7d views and rank the top 5 recent videos', async () => {
    fetchMock = mockFetch(() =>
      jsonResponse({
        data: {
          videos: [
            { id: 'a', create_time: daysAgo(1), view_count: 10 },
            { id: 'b', create_time: daysAgo(2), view_count: 5, like_count: 50 },
            { id: 'c', create_time: daysAgo(3), view_count: 1 },
            { id: 'd', create_time: daysAgo(4), view_count: 30 },
            {
              id: 'e',
              create_time: daysAgo(5),
              view_count: 20,
              share_count: 5,
            },
            { id: 'f', create_time: daysAgo(6), view_count: 2 },
            { id: 'old', create_time: daysAgo(9), view_count: 9999 },
            { id: 'no-date', view_count: 9999 },
          ],
        },
      }),
    )

    const weekly = expectOk(await getWeeklyEngagement('u1', 'ws1'))

    expect(weekly.views7d).toBe(10 + 5 + 1 + 30 + 20 + 2)
    expect(weekly.top5.map((v) => [v.id, v.engagementScore])).toEqual([
      ['b', 55],
      ['d', 30],
      ['e', 25],
      ['a', 10],
      ['f', 2],
    ])
  })

  it('should propagate the listing failure', async () => {
    fetchMock = mockFetch(() => textResponse('', { status: 500 }))
    expectErr(await getWeeklyEngagement('u1', 'ws1'), 'CRM_SOCIAL_OAUTH_FAILED')
  })
})

describe('publishVideo()', () => {
  const UPLOAD_URL = 'https://upload.tiktok.test/u1'

  function route(overrides: {
    init?: () => Response
    upload?: () => Response
  }) {
    return mockFetch((url) => {
      if (url === `${API}/post/publish/video/init/`) {
        return (
          overrides.init?.() ??
          jsonResponse({
            data: { publish_id: 'pub-1', upload_url: UPLOAD_URL },
            error: { code: 'ok' },
          })
        )
      }
      if (url === UPLOAD_URL) {
        return overrides.upload?.() ?? new Response(null, { status: 201 })
      }
      throw new Error(`unexpected ${url}`)
    })
  }

  it('should init a Direct Post and upload the bytes in one chunk', async () => {
    fetchMock = route({})
    const f = file()

    expect(expectOk(await publishVideo('u1', 'ws1', publishInput, f))).toEqual({
      publishId: 'pub-1',
      status: 'PROCESSING_UPLOAD',
    })

    const [init, upload] = fetchMock.calls()
    expect(init.init?.method).toBe('POST')
    expect(headerOf(init, 'Authorization')).toBe('Bearer tt-token')
    expect(JSON.parse(String(init.init?.body))).toEqual({
      post_info: {
        title: 'Meu vídeo',
        privacy_level: 'SELF_ONLY',
        disable_comment: true,
        disable_duet: false,
        disable_stitch: true,
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: 8,
        chunk_size: 8,
        total_chunk_count: 1,
      },
    })
    expect(upload.init?.method).toBe('PUT')
    expect(headerOf(upload, 'Content-Type')).toBe('video/quicktime')
    expect(headerOf(upload, 'Content-Length')).toBe('8')
    expect(headerOf(upload, 'Content-Range')).toBe('bytes 0-7/8')
    expect(upload.init?.body).toBe(f.bytes)
  })

  it('should default the upload Content-Type to video/mp4', async () => {
    fetchMock = route({})
    expectOk(await publishVideo('u1', 'ws1', publishInput, file('')))
    expect(headerOf(fetchMock.calls()[1], 'Content-Type')).toBe('video/mp4')
  })

  it('should explain the private-account requirement of an unaudited app', async () => {
    fetchMock = route({
      init: () =>
        jsonResponse(
          {
            error: {
              code: 'unaudited_client_can_only_post_to_private_accounts',
            },
          },
          { status: 403 },
        ),
    })

    const error = expectErr(
      await publishVideo('u1', 'ws1', publishInput, file()),
      'BAD_REQUEST',
    )
    expect(error.message).toContain('Privada')
    expect(fetchMock.calls()).toHaveLength(1)
  })

  it('should map any other init error to CRM_SOCIAL_OAUTH_FAILED', async () => {
    fetchMock = route({
      init: () => jsonResponse({ error: { code: 'spam_risk_too_many_posts' } }),
    })
    expectErr(
      await publishVideo('u1', 'ws1', publishInput, file()),
      'CRM_SOCIAL_OAUTH_FAILED',
    )
  })

  it('should fail on an init 5xx with a malformed body', async () => {
    fetchMock = route({ init: () => textResponse('oops', { status: 502 }) })
    expectErr(
      await publishVideo('u1', 'ws1', publishInput, file()),
      'CRM_SOCIAL_OAUTH_FAILED',
    )
  })

  it('should fail when the init omits the upload url', async () => {
    fetchMock = route({
      init: () => jsonResponse({ data: { publish_id: 'pub-1' } }),
    })
    expectErr(
      await publishVideo('u1', 'ws1', publishInput, file()),
      'CRM_SOCIAL_OAUTH_FAILED',
    )
    expect(fetchMock.calls()).toHaveLength(1)
  })

  it('should fail when the byte upload is rejected', async () => {
    fetchMock = route({
      upload: () => textResponse('range mismatch', { status: 416 }),
    })
    expectErr(
      await publishVideo('u1', 'ws1', publishInput, file()),
      'CRM_SOCIAL_OAUTH_FAILED',
    )
  })

  it('should fail cleanly when the rejected upload body cannot be read', async () => {
    fetchMock = route({ upload: () => unreadableResponse({ status: 500 }) })
    expectErr(
      await publishVideo('u1', 'ws1', publishInput, file()),
      'CRM_SOCIAL_OAUTH_FAILED',
    )
  })

  it('should map a network error to CRM_SOCIAL_OAUTH_FAILED', async () => {
    fetchMock = mockFetch(() => {
      throw new TypeError('fetch failed')
    })
    expectErr(
      await publishVideo('u1', 'ws1', publishInput, file()),
      'CRM_SOCIAL_OAUTH_FAILED',
    )
  })
})
