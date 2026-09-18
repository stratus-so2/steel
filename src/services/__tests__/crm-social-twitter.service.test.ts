import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  deleteTweet,
  getOverview,
  getRecentTweets,
  publishTweetPost,
} from '../crm-social-twitter.service'

const API = 'https://api.twitter.com/2'
const UPLOAD_API = 'https://api.x.com/2/media/upload'
const ALL_SCOPES = 'users.read tweet.read tweet.write offline.access'

let fetchMock: ReturnType<typeof mockFetch>

function image(contentType = 'image/png') {
  return { bytes: new Uint8Array([1, 2]).buffer, contentType }
}

beforeEach(() => {
  fetchMock = mockFetch(() => {
    throw new Error('unexpected fetch')
  })
  asMember('MEMBER')
  withToken({ scope: ALL_SCOPES, externalAccountId: 'user-42' }, 'x-token')
})

describeSocialAuthz(
  [
    {
      name: 'getOverview()',
      action: 'VIEW',
      scope: 'users.read',
      call: () => getOverview('u1', 'ws1'),
    },
    {
      name: 'getRecentTweets()',
      action: 'VIEW',
      scope: 'tweet.read',
      call: () => getRecentTweets('u1', 'ws1'),
    },
    {
      name: 'publishTweetPost()',
      action: 'CREATE',
      scope: 'tweet.write',
      call: () => publishTweetPost('u1', 'ws1', { text: 'Oi' }, null),
    },
    {
      name: 'deleteTweet()',
      action: 'DELETE',
      scope: 'tweet.write',
      call: () => deleteTweet('u1', 'ws1', 't1'),
    },
  ],
  () => fetchMock.spy,
)

describe('getOverview()', () => {
  it('should read the authenticated user identity', async () => {
    fetchMock = mockFetch(() =>
      jsonResponse({
        data: {
          id: '42',
          username: 'acme',
          name: 'Acme',
          profile_image_url: 'https://x/p.jpg',
        },
      }),
    )

    expect(expectOk(await getOverview('u1', 'ws1'))).toEqual({
      id: '42',
      username: 'acme',
      name: 'Acme',
      profileImageUrl: 'https://x/p.jpg',
    })
    const [call] = fetchMock.calls()
    expect(call.url).toBe(
      `${API}/users/me?user.fields=profile_image_url,username,name`,
    )
    expect(headerOf(call, 'Authorization')).toBe('Bearer x-token')
  })

  it('should fill defaults when the payload has no data', async () => {
    fetchMock = mockFetch(() => jsonResponse({}))
    expect(expectOk(await getOverview('u1', 'ws1'))).toEqual({
      id: 'unknown',
      username: '',
      name: null,
      profileImageUrl: null,
    })
  })

  it('should propagate a 401 as CRM_SOCIAL_OAUTH_FAILED', async () => {
    fetchMock = mockFetch(() => textResponse('Unauthorized', { status: 401 }))
    expectErr(await getOverview('u1', 'ws1'), 'CRM_SOCIAL_OAUTH_FAILED')
  })
})

describe('getRecentTweets()', () => {
  it('should list own tweets without retweets/replies and map metrics', async () => {
    fetchMock = mockFetch(() =>
      jsonResponse({
        data: [
          {
            id: 't1',
            text: 'Olá',
            created_at: '2026-09-17T10:00:00.000Z',
            public_metrics: {
              like_count: 3,
              retweet_count: 1,
              reply_count: 0,
              impression_count: 120,
            },
          },
          { id: 't2', public_metrics: {} },
          {},
        ],
      }),
    )

    const { tweets } = expectOk(await getRecentTweets('u1', 'ws1'))

    expect(tweets).toEqual([
      {
        id: 't1',
        text: 'Olá',
        createdAt: '2026-09-17T10:00:00.000Z',
        url: 'https://twitter.com/i/web/status/t1',
        metrics: {
          likeCount: 3,
          retweetCount: 1,
          replyCount: 0,
          impressionCount: 120,
        },
      },
      {
        id: 't2',
        text: '',
        createdAt: null,
        url: 'https://twitter.com/i/web/status/t2',
        metrics: {
          likeCount: 0,
          retweetCount: 0,
          replyCount: 0,
          impressionCount: 0,
        },
      },
      { id: '', text: '', createdAt: null, url: '', metrics: null },
    ])
    const url = new URL(fetchMock.calls()[0].url)
    expect(url.pathname).toBe('/2/users/user-42/tweets')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      'tweet.fields': 'created_at,public_metrics',
      max_results: '10',
      exclude: 'retweets,replies',
    })
  })

  it('should return an empty list when data is absent', async () => {
    fetchMock = mockFetch(() => jsonResponse({ meta: { result_count: 0 } }))
    expect(expectOk(await getRecentTweets('u1', 'ws1')).tweets).toEqual([])
  })

  it('should propagate a 429 from the free tier', async () => {
    fetchMock = mockFetch(() =>
      jsonResponse({ title: 'Too Many Requests' }, { status: 429 }),
    )
    expectErr(await getRecentTweets('u1', 'ws1'), 'CRM_SOCIAL_OAUTH_FAILED')
  })
})

describe('publishTweetPost()', () => {
  it('should POST a text-only tweet', async () => {
    fetchMock = mockFetch(() => jsonResponse({ data: { id: 't9' } }))

    expect(
      expectOk(await publishTweetPost('u1', 'ws1', { text: 'Olá X' }, null)),
    ).toEqual({
      tweetId: 't9',
      permalink: 'https://twitter.com/i/web/status/t9',
    })
    const [call] = fetchMock.calls()
    expect(call.url).toBe(`${API}/tweets`)
    expect(call.init?.method).toBe('POST')
    expect(headerOf(call, 'Authorization')).toBe('Bearer x-token')
    expect(JSON.parse(String(call.init?.body))).toEqual({ text: 'Olá X' })
  })

  it('should upload the image first and attach its media id', async () => {
    fetchMock = mockFetch((url) =>
      url === UPLOAD_API
        ? jsonResponse({ data: { id: 'media-1' } })
        : jsonResponse({ data: { id: 't10' } }),
    )

    expectOk(await publishTweetPost('u1', 'ws1', { text: 'Com foto' }, image()))

    const [upload, tweet] = fetchMock.calls()
    expect(upload.url).toBe(UPLOAD_API)
    expect(headerOf(upload, 'Authorization')).toBe('Bearer x-token')
    const form = upload.init?.body as FormData
    expect(form.get('media_category')).toBe('tweet_image')
    expect((form.get('media') as File).type).toBe('image/png')
    expect(JSON.parse(String(tweet.init?.body))).toEqual({
      text: 'Com foto',
      media: { media_ids: ['media-1'] },
    })
  })

  it('should accept the v1.1 media_id_string and default the image type', async () => {
    fetchMock = mockFetch((url) =>
      url === UPLOAD_API
        ? jsonResponse({ media_id_string: 'legacy-1' })
        : jsonResponse({ data: { id: 't11' } }),
    )

    expectOk(await publishTweetPost('u1', 'ws1', { text: 'x' }, image('')))

    const [upload, tweet] = fetchMock.calls()
    expect(((upload.init?.body as FormData).get('media') as File).type).toBe(
      'image/jpeg',
    )
    expect(JSON.parse(String(tweet.init?.body)).media.media_ids).toEqual([
      'legacy-1',
    ])
  })

  it.each([
    ['rejected (403)', () => textResponse('forbidden', { status: 403 })],
    ['answered without a media id', () => jsonResponse({})],
    ['answered with malformed JSON', () => textResponse('<html>')],
    [
      'rejected with an unreadable body',
      () => unreadableResponse({ status: 500 }),
    ],
  ])('should not tweet when the media upload is %s', async (_, upload) => {
    fetchMock = mockFetch((url) => {
      if (url === UPLOAD_API) return upload()
      throw new Error('tweet must not be sent')
    })

    expectErr(
      await publishTweetPost('u1', 'ws1', { text: 'x' }, image()),
      'CRM_SOCIAL_OAUTH_FAILED',
    )
    expect(fetchMock.calls()).toHaveLength(1)
  })

  it('should map a media upload network error', async () => {
    fetchMock = mockFetch(() => {
      throw new TypeError('fetch failed')
    })
    expectErr(
      await publishTweetPost('u1', 'ws1', { text: 'x' }, image()),
      'CRM_SOCIAL_OAUTH_FAILED',
    )
  })

  it.each([
    [
      'rejected (duplicate content)',
      () => textResponse('dup', { status: 403 }),
    ],
    ['answered without an id', () => jsonResponse({ data: {} })],
    ['answered with malformed JSON', () => textResponse('nope')],
  ])('should fail when the tweet is %s', async (_, response) => {
    fetchMock = mockFetch(() => response())
    expectErr(
      await publishTweetPost('u1', 'ws1', { text: 'x' }, null),
      'CRM_SOCIAL_OAUTH_FAILED',
    )
  })

  it('should map a tweet network error', async () => {
    fetchMock = mockFetch(() => {
      throw new TypeError('fetch failed')
    })
    expectErr(
      await publishTweetPost('u1', 'ws1', { text: 'x' }, null),
      'CRM_SOCIAL_OAUTH_FAILED',
    )
  })
})

describe('deleteTweet()', () => {
  beforeEach(() => {
    asMember('ADMIN')
  })

  it('should DELETE the tweet and confirm deleted=true', async () => {
    fetchMock = mockFetch(() => jsonResponse({ data: { deleted: true } }))

    expect(expectOk(await deleteTweet('u1', 'ws1', 't1'))).toEqual({
      deletedId: 't1',
    })
    const [call] = fetchMock.calls()
    expect(call.url).toBe(`${API}/tweets/t1`)
    expect(call.init?.method).toBe('DELETE')
    expect(headerOf(call, 'Authorization')).toBe('Bearer x-token')
  })

  it.each([
    ['deleted=false', () => jsonResponse({ data: { deleted: false } })],
    ['a malformed body', () => textResponse('???')],
    ['a 404', () => textResponse('Not Found', { status: 404 })],
  ])('should fail on %s', async (_, response) => {
    fetchMock = mockFetch(() => response())
    expectErr(await deleteTweet('u1', 'ws1', 't1'), 'CRM_SOCIAL_OAUTH_FAILED')
  })

  it('should map a network error', async () => {
    fetchMock = mockFetch(() => {
      throw new TypeError('fetch failed')
    })
    expectErr(await deleteTweet('u1', 'ws1', 't1'), 'CRM_SOCIAL_OAUTH_FAILED')
  })
})
