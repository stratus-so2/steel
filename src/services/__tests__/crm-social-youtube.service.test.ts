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
  deleteVideo,
  getInsights,
  getOverview,
  getRecentVideos,
  publishVideo,
} from '../crm-social-youtube.service'

const DATA_API = 'https://www.googleapis.com/youtube/v3'
const ALL_SCOPES =
  'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.force-ssl'
const NOW = new Date('2026-09-18T12:00:00.000Z')

let fetchMock: ReturnType<typeof mockFetch>

const publishInput = {
  title: 'Meu vídeo',
  description: 'Descrição',
  tags: ['a', 'b'],
  privacyStatus: 'unlisted' as const,
}

function file() {
  return { bytes: new Uint8Array(10).buffer, contentType: 'video/mp4' }
}

beforeEach(() => {
  fetchMock = mockFetch(() => {
    throw new Error('unexpected fetch')
  })
  asMember('MEMBER')
  withToken({ scope: ALL_SCOPES, externalAccountId: 'UC1' }, 'yt-token')
})

afterEach(() => {
  vi.useRealTimers()
})

describeSocialAuthz(
  [
    {
      name: 'getOverview()',
      action: 'VIEW',
      scope: 'youtube.readonly',
      call: () => getOverview('u1', 'ws1'),
    },
    {
      name: 'getInsights()',
      action: 'VIEW',
      scope: 'yt-analytics.readonly',
      call: () => getInsights('u1', 'ws1', '7d'),
    },
    {
      name: 'getRecentVideos()',
      action: 'VIEW',
      scope: 'youtube.readonly',
      call: () => getRecentVideos('u1', 'ws1'),
    },
    {
      name: 'publishVideo()',
      action: 'CREATE',
      scope: 'youtube.upload',
      call: () => publishVideo('u1', 'ws1', publishInput, file()),
    },
    {
      name: 'deleteVideo()',
      action: 'DELETE',
      scope: 'youtube.force-ssl',
      call: () => deleteVideo('u1', 'ws1', 'v1'),
    },
  ],
  () => fetchMock.spy,
)

describe('getOverview()', () => {
  it('should read the own channel and map snippet + statistics', async () => {
    fetchMock = mockFetch(() =>
      jsonResponse({
        items: [
          {
            id: 'UC1',
            snippet: {
              title: 'Acme TV',
              description: 'Canal',
              customUrl: '@acme',
              thumbnails: {
                medium: { url: 'https://yt/m.jpg' },
                default: { url: 'https://yt/d.jpg' },
              },
            },
            statistics: {
              subscriberCount: '1500',
              viewCount: '90000',
              videoCount: '42',
            },
          },
        ],
      }),
    )

    expect(expectOk(await getOverview('u1', 'ws1'))).toEqual({
      channelId: 'UC1',
      title: 'Acme TV',
      description: 'Canal',
      customUrl: '@acme',
      thumbnailUrl: 'https://yt/m.jpg',
      subscriberCount: 1500,
      viewCount: 90000,
      videoCount: 42,
    })
    const [call] = fetchMock.calls()
    expect(call.url).toBe(
      `${DATA_API}/channels?part=snippet,statistics&mine=true`,
    )
    expect(headerOf(call, 'Authorization')).toBe('Bearer yt-token')
  })

  it('should fall back to the default thumbnail and defaults', async () => {
    fetchMock = mockFetch(() =>
      jsonResponse({
        items: [
          {
            id: 'UC1',
            snippet: { thumbnails: { default: { url: 'https://yt/d.jpg' } } },
          },
        ],
      }),
    )

    expect(expectOk(await getOverview('u1', 'ws1'))).toEqual({
      channelId: 'UC1',
      title: 'Canal',
      description: null,
      customUrl: null,
      thumbnailUrl: 'https://yt/d.jpg',
      subscriberCount: 0,
      viewCount: 0,
      videoCount: 0,
    })
  })

  it('should return a null thumbnail when the channel has no snippet', async () => {
    fetchMock = mockFetch(() => jsonResponse({ items: [{ id: 'UC1' }] }))
    expect(expectOk(await getOverview('u1', 'ws1')).thumbnailUrl).toBeNull()
  })

  it('should fail when the account has no channel', async () => {
    fetchMock = mockFetch(() => jsonResponse({}))
    expectErr(await getOverview('u1', 'ws1'), 'CRM_SOCIAL_OAUTH_FAILED')
  })

  it('should propagate a 403 quotaExceeded', async () => {
    fetchMock = mockFetch(() =>
      jsonResponse({ error: { message: 'quotaExceeded' } }, { status: 403 }),
    )
    const error = expectErr(
      await getOverview('u1', 'ws1'),
      'CRM_SOCIAL_OAUTH_FAILED',
    )
    expect(error.message).toBe('quotaExceeded')
  })
})

describe('getInsights()', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })

  it('should query the analytics report until yesterday and total the rows', async () => {
    fetchMock = mockFetch(() =>
      jsonResponse({
        rows: [
          ['2026-09-10', 100, 250, 3],
          ['2026-09-11', '50', 'x', 1],
        ],
      }),
    )

    expect(expectOk(await getInsights('u1', 'ws1', '28d'))).toEqual({
      range: '28d',
      startDate: '2026-08-21',
      endDate: '2026-09-17',
      totals: {
        views: 150,
        estimatedMinutesWatched: 250,
        subscribersGained: 4,
      },
      series: [
        {
          date: '2026-09-10',
          views: 100,
          estimatedMinutesWatched: 250,
          subscribersGained: 3,
        },
        {
          date: '2026-09-11',
          views: 50,
          estimatedMinutesWatched: 0,
          subscribersGained: 1,
        },
      ],
    })
    const url = new URL(fetchMock.calls()[0].url)
    expect(`${url.origin}${url.pathname}`).toBe(
      'https://youtubeanalytics.googleapis.com/v2/reports',
    )
    expect(Object.fromEntries(url.searchParams)).toEqual({
      ids: 'channel==MINE',
      startDate: '2026-08-21',
      endDate: '2026-09-17',
      metrics: 'views,estimatedMinutesWatched,subscribersGained',
      dimensions: 'day',
      sort: 'day',
    })
  })

  it('should return an empty series when there are no rows', async () => {
    fetchMock = mockFetch(() => jsonResponse({}))
    const insights = expectOk(await getInsights('u1', 'ws1', '7d'))
    expect(insights.startDate).toBe('2026-09-11')
    expect(insights.series).toEqual([])
  })

  it('should propagate an analytics API failure (API not enabled)', async () => {
    fetchMock = mockFetch(() => textResponse('not enabled', { status: 403 }))
    expectErr(await getInsights('u1', 'ws1', '7d'), 'CRM_SOCIAL_OAUTH_FAILED')
  })
})

describe('getRecentVideos()', () => {
  function route(overrides: {
    channels?: () => Response
    playlist?: () => Response
    videos?: () => Response
  }) {
    return mockFetch((url) => {
      const path = new URL(url).pathname
      if (path.endsWith('/channels')) {
        return (
          overrides.channels?.() ??
          jsonResponse({
            items: [
              { contentDetails: { relatedPlaylists: { uploads: 'UU1' } } },
            ],
          })
        )
      }
      if (path.endsWith('/playlistItems')) {
        return overrides.playlist?.() ?? jsonResponse({ items: [] })
      }
      if (path.endsWith('/videos')) {
        return overrides.videos?.() ?? jsonResponse({ items: [] })
      }
      throw new Error(`unexpected ${url}`)
    })
  }

  it('should walk uploads playlist → items → stats and merge them', async () => {
    fetchMock = route({
      playlist: () =>
        jsonResponse({
          items: [
            {
              snippet: {
                title: 'V1',
                publishedAt: '2026-09-10T00:00:00Z',
                thumbnails: { medium: { url: 'https://yt/v1.jpg' } },
              },
              contentDetails: { videoId: 'v1' },
            },
            {
              snippet: {
                thumbnails: { default: { url: 'https://yt/v2.jpg' } },
              },
              contentDetails: { videoId: 'v2' },
            },
            { contentDetails: { videoId: 'v3' } },
            { snippet: { title: 'deleted' }, contentDetails: {} },
            {},
          ],
        }),
      videos: () =>
        jsonResponse({
          items: [
            {
              id: 'v1',
              statistics: {
                viewCount: '10',
                likeCount: '2',
                commentCount: '1',
              },
              contentDetails: { duration: 'PT1M' },
            },
            { id: 'v2' },
            { statistics: { viewCount: '999' } },
          ],
        }),
    })

    const { videos } = expectOk(await getRecentVideos('u1', 'ws1'))

    expect(videos).toEqual([
      {
        videoId: 'v1',
        title: 'V1',
        thumbnailUrl: 'https://yt/v1.jpg',
        publishedAt: '2026-09-10T00:00:00Z',
        url: 'https://www.youtube.com/watch?v=v1',
        viewCount: 10,
        likeCount: 2,
        commentCount: 1,
        duration: 'PT1M',
      },
      {
        videoId: 'v2',
        title: '',
        thumbnailUrl: 'https://yt/v2.jpg',
        publishedAt: '',
        url: 'https://www.youtube.com/watch?v=v2',
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
        duration: null,
      },
      {
        videoId: 'v3',
        title: '',
        thumbnailUrl: null,
        publishedAt: '',
        url: 'https://www.youtube.com/watch?v=v3',
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
        duration: null,
      },
    ])
    const [, playlist, stats] = fetchMock.calls()
    const pl = new URL(playlist.url).searchParams
    expect(pl.get('playlistId')).toBe('UU1')
    expect(pl.get('maxResults')).toBe('20')
    expect(new URL(stats.url).searchParams.get('id')).toBe('v1,v2,v3')
  })

  it('should keep the videos with zeroed stats when the stats call fails', async () => {
    fetchMock = route({
      playlist: () =>
        jsonResponse({ items: [{ contentDetails: { videoId: 'v1' } }] }),
      videos: () => textResponse('boom', { status: 500 }),
    })

    const { videos } = expectOk(await getRecentVideos('u1', 'ws1'))
    expect(videos).toHaveLength(1)
    expect(videos[0]).toMatchObject({ videoId: 'v1', viewCount: 0 })
  })

  it('should tolerate a stats payload without items', async () => {
    fetchMock = route({
      playlist: () =>
        jsonResponse({ items: [{ contentDetails: { videoId: 'v1' } }] }),
      videos: () => jsonResponse({}),
    })
    expect(expectOk(await getRecentVideos('u1', 'ws1')).videos).toHaveLength(1)
  })

  it('should skip the stats call for an empty playlist', async () => {
    fetchMock = route({ playlist: () => jsonResponse({}) })

    expect(expectOk(await getRecentVideos('u1', 'ws1')).videos).toEqual([])
    expect(fetchMock.calls()).toHaveLength(2)
  })

  it('should fail when the channel has no uploads playlist', async () => {
    fetchMock = route({ channels: () => jsonResponse({ items: [] }) })
    expectErr(await getRecentVideos('u1', 'ws1'), 'CRM_SOCIAL_OAUTH_FAILED')
  })

  it('should propagate a channels failure', async () => {
    fetchMock = route({ channels: () => textResponse('', { status: 401 }) })
    expectErr(await getRecentVideos('u1', 'ws1'), 'CRM_SOCIAL_OAUTH_FAILED')
  })

  it('should propagate a playlist failure', async () => {
    fetchMock = route({ playlist: () => textResponse('', { status: 404 }) })
    expectErr(await getRecentVideos('u1', 'ws1'), 'CRM_SOCIAL_OAUTH_FAILED')
  })
})

describe('publishVideo()', () => {
  const UPLOAD_URL = 'https://upload.youtube.test/session-1'

  function route(overrides: {
    init?: () => Response
    upload?: () => Response
  }) {
    return mockFetch((url) => {
      if (url.startsWith('https://www.googleapis.com/upload/')) {
        return (
          overrides.init?.() ??
          new Response(null, { status: 200, headers: { Location: UPLOAD_URL } })
        )
      }
      if (url === UPLOAD_URL) {
        return (
          overrides.upload?.() ??
          jsonResponse({
            id: 'vid-1',
            snippet: { title: 'Título final' },
            status: { privacyStatus: 'private' },
          })
        )
      }
      throw new Error(`unexpected ${url}`)
    })
  }

  it('should open a resumable session with metadata and PUT the bytes', async () => {
    fetchMock = route({})
    const f = file()

    const result = expectOk(await publishVideo('u1', 'ws1', publishInput, f))

    expect(result).toEqual({
      videoId: 'vid-1',
      url: 'https://www.youtube.com/watch?v=vid-1',
      title: 'Título final',
      privacyStatus: 'private',
    })
    const [init, upload] = fetchMock.calls()
    expect(init.url).toContain('uploadType=resumable')
    expect(init.init?.method).toBe('POST')
    expect(headerOf(init, 'Authorization')).toBe('Bearer yt-token')
    expect(headerOf(init, 'X-Upload-Content-Type')).toBe('video/mp4')
    expect(headerOf(init, 'X-Upload-Content-Length')).toBe('10')
    expect(JSON.parse(String(init.init?.body))).toEqual({
      snippet: {
        title: 'Meu vídeo',
        description: 'Descrição',
        tags: ['a', 'b'],
      },
      status: { privacyStatus: 'unlisted' },
    })
    expect(upload.init?.method).toBe('PUT')
    expect(headerOf(upload, 'Content-Type')).toBe('video/mp4')
    expect(upload.init?.body).toBe(f.bytes)
  })

  it('should fall back to the input title/privacy when the API omits them', async () => {
    fetchMock = route({ upload: () => jsonResponse({ id: 'vid-2' }) })

    const result = expectOk(
      await publishVideo('u1', 'ws1', publishInput, file()),
    )
    expect(result).toMatchObject({
      title: 'Meu vídeo',
      privacyStatus: 'unlisted',
    })
  })

  it('should fail when the session init is rejected', async () => {
    fetchMock = route({ init: () => textResponse('bad', { status: 400 }) })
    expectErr(
      await publishVideo('u1', 'ws1', publishInput, file()),
      'CRM_SOCIAL_OAUTH_FAILED',
    )
    expect(fetchMock.calls()).toHaveLength(1)
  })

  it('should still fail cleanly when the error body cannot be read', async () => {
    fetchMock = route({ init: () => unreadableResponse({ status: 500 }) })
    expectErr(
      await publishVideo('u1', 'ws1', publishInput, file()),
      'CRM_SOCIAL_OAUTH_FAILED',
    )
  })

  it('should fail when the init has no Location header', async () => {
    fetchMock = route({ init: () => new Response(null, { status: 200 }) })
    expectErr(
      await publishVideo('u1', 'ws1', publishInput, file()),
      'CRM_SOCIAL_OAUTH_FAILED',
    )
    expect(fetchMock.calls()).toHaveLength(1)
  })

  it('should fail when the byte upload fails', async () => {
    fetchMock = route({ upload: () => textResponse('', { status: 503 }) })
    expectErr(
      await publishVideo('u1', 'ws1', publishInput, file()),
      'CRM_SOCIAL_OAUTH_FAILED',
    )
  })

  it('should fail when the upload response has no video id', async () => {
    fetchMock = route({ upload: () => jsonResponse({}) })
    expectErr(
      await publishVideo('u1', 'ws1', publishInput, file()),
      'CRM_SOCIAL_OAUTH_FAILED',
    )
  })

  it('should map a malformed upload response to CRM_SOCIAL_OAUTH_FAILED', async () => {
    fetchMock = route({ upload: () => textResponse('<html>') })
    expectErr(
      await publishVideo('u1', 'ws1', publishInput, file()),
      'CRM_SOCIAL_OAUTH_FAILED',
    )
  })
})

describe('deleteVideo()', () => {
  beforeEach(() => {
    asMember('OWNER')
  })

  it('should DELETE the video (204 No Content) and echo its id', async () => {
    fetchMock = mockFetch(() => new Response(null, { status: 204 }))

    expect(expectOk(await deleteVideo('u1', 'ws1', 'v 1'))).toEqual({
      deletedId: 'v 1',
    })
    const [call] = fetchMock.calls()
    expect(call.url).toBe(`${DATA_API}/videos?id=v%201`)
    expect(call.init?.method).toBe('DELETE')
    expect(headerOf(call, 'Authorization')).toBe('Bearer yt-token')
  })

  it('should propagate a 404 for an unknown video', async () => {
    fetchMock = mockFetch(() =>
      jsonResponse({ error: { message: 'videoNotFound' } }, { status: 404 }),
    )
    const error = expectErr(
      await deleteVideo('u1', 'ws1', 'v1'),
      'CRM_SOCIAL_OAUTH_FAILED',
    )
    expect(error.message).toBe('videoNotFound')
  })
})
