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
  deletePost,
  getOverview,
  publishPost,
} from '../crm-social-linkedin.service'

const REST = 'https://api.linkedin.com/rest'
const ALL_SCOPES = 'openid profile email w_member_social'
const UPLOAD_URL = 'https://upload.linkedin.test/img-1'

let fetchMock: ReturnType<typeof mockFetch>

function image(contentType = 'image/png') {
  return { bytes: new Uint8Array([7, 7]).buffer, contentType }
}

beforeEach(() => {
  fetchMock = mockFetch(() => {
    throw new Error('unexpected fetch')
  })
  asMember('MEMBER')
  withToken({ scope: ALL_SCOPES, externalAccountId: 'person-1' }, 'li-token')
})

describeSocialAuthz(
  [
    {
      name: 'getOverview()',
      action: 'VIEW',
      scope: 'profile',
      call: () => getOverview('u1', 'ws1'),
    },
    {
      name: 'publishPost()',
      action: 'CREATE',
      scope: 'w_member_social',
      call: () => publishPost('u1', 'ws1', { text: 'Oi' }),
    },
    {
      name: 'deletePost()',
      action: 'DELETE',
      scope: 'w_member_social',
      call: () => deletePost('u1', 'ws1', 'urn:li:share:1'),
    },
  ],
  () => fetchMock.spy,
)

describe('getOverview()', () => {
  it('should read the OIDC userinfo of the member', async () => {
    fetchMock = mockFetch(() =>
      jsonResponse({
        sub: 'person-1',
        name: 'Ana',
        email: 'ana@acme.test',
        picture: 'https://li/p.jpg',
      }),
    )

    expect(expectOk(await getOverview('u1', 'ws1'))).toEqual({
      personId: 'person-1',
      name: 'Ana',
      headline: null,
      email: 'ana@acme.test',
      picture: 'https://li/p.jpg',
    })
    const [call] = fetchMock.calls()
    expect(call.url).toBe('https://api.linkedin.com/v2/userinfo')
    expect(headerOf(call, 'Authorization')).toBe('Bearer li-token')
  })

  it('should fill defaults for an empty userinfo', async () => {
    fetchMock = mockFetch(() => jsonResponse({}))
    expect(expectOk(await getOverview('u1', 'ws1'))).toEqual({
      personId: 'unknown',
      name: null,
      headline: null,
      email: null,
      picture: null,
    })
  })

  it.each([
    ['a 401', () => textResponse('expired', { status: 401 })],
    ['an unreadable 500', () => unreadableResponse({ status: 500 })],
  ])('should fail on %s', async (_, response) => {
    fetchMock = mockFetch(() => response())
    expectErr(await getOverview('u1', 'ws1'), 'CRM_SOCIAL_OAUTH_FAILED')
  })

  it('should map a network error', async () => {
    fetchMock = mockFetch(() => {
      throw new TypeError('fetch failed')
    })
    expectErr(await getOverview('u1', 'ws1'), 'CRM_SOCIAL_OAUTH_FAILED')
  })
})

describe('publishPost()', () => {
  function route(overrides: {
    init?: () => Response
    upload?: () => Response
    post?: () => Response
  }) {
    return mockFetch((url) => {
      if (url === `${REST}/images?action=initializeUpload`) {
        return (
          overrides.init?.() ??
          jsonResponse({
            value: { uploadUrl: UPLOAD_URL, image: 'urn:li:image:1' },
          })
        )
      }
      if (url === UPLOAD_URL) {
        return overrides.upload?.() ?? new Response(null, { status: 201 })
      }
      if (url === `${REST}/posts`) {
        return (
          overrides.post?.() ??
          new Response(null, {
            status: 201,
            headers: { 'x-restli-id': 'urn:li:share:99' },
          })
        )
      }
      throw new Error(`unexpected ${url}`)
    })
  }

  it('should publish a text post with escaped commentary and versioned headers', async () => {
    fetchMock = route({})

    expect(
      expectOk(
        await publishPost('u1', 'ws1', { text: 'Oi (mundo) #novo @ana_x' }),
      ),
    ).toEqual({ postUrn: 'urn:li:share:99' })

    const [call] = fetchMock.calls()
    expect(call.url).toBe(`${REST}/posts`)
    expect(call.init?.method).toBe('POST')
    expect(headerOf(call, 'Authorization')).toBe('Bearer li-token')
    expect(headerOf(call, 'LinkedIn-Version')).toBe('202404')
    expect(headerOf(call, 'X-RestLi-Protocol-Version')).toBe('2.0.0')
    expect(JSON.parse(String(call.init?.body))).toEqual({
      author: 'urn:li:person:person-1',
      commentary: 'Oi \\(mundo\\) \\#novo \\@ana\\_x',
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    })
  })

  it('should fall back to "unknown" when the post URN header is missing', async () => {
    fetchMock = route({ post: () => new Response(null, { status: 201 }) })
    expect(expectOk(await publishPost('u1', 'ws1', { text: 'x' }))).toEqual({
      postUrn: 'unknown',
    })
  })

  it('should upload the image and reference its URN in the post', async () => {
    fetchMock = route({})
    const img = image()

    expectOk(await publishPost('u1', 'ws1', { text: 'Foto' }, img))

    const [init, upload, post] = fetchMock.calls()
    expect(JSON.parse(String(init.init?.body))).toEqual({
      initializeUploadRequest: { owner: 'urn:li:person:person-1' },
    })
    expect(upload.init?.method).toBe('PUT')
    expect(headerOf(upload, 'Content-Type')).toBe('image/png')
    expect(headerOf(upload, 'Authorization')).toBe('Bearer li-token')
    expect(upload.init?.body).toBe(img.bytes)
    expect(JSON.parse(String(post.init?.body)).content).toEqual({
      media: { id: 'urn:li:image:1', altText: '' },
    })
  })

  it('should default the upload Content-Type to octet-stream', async () => {
    fetchMock = route({})
    expectOk(await publishPost('u1', 'ws1', { text: 'x' }, image('')))
    expect(headerOf(fetchMock.calls()[1], 'Content-Type')).toBe(
      'application/octet-stream',
    )
  })

  it.each([
    ['rejected', { init: () => textResponse('no', { status: 403 }) }, 1],
    [
      'incomplete',
      { init: () => jsonResponse({ value: { uploadUrl: UPLOAD_URL } }) },
      1,
    ],
    ['malformed', { init: () => textResponse('<html>') }, 1],
    [
      'uploaded but PUT fails',
      { upload: () => textResponse('', { status: 500 }) },
      2,
    ],
  ])('should not publish when the image upload is %s', async (_, overrides, calls) => {
    fetchMock = route(overrides)

    expectErr(
      await publishPost('u1', 'ws1', { text: 'x' }, image()),
      'CRM_SOCIAL_OAUTH_FAILED',
    )
    expect(fetchMock.calls()).toHaveLength(calls)
  })

  it('should map a network error during initializeUpload', async () => {
    fetchMock = mockFetch(() => {
      throw new TypeError('fetch failed')
    })
    expectErr(
      await publishPost('u1', 'ws1', { text: 'x' }, image()),
      'CRM_SOCIAL_OAUTH_FAILED',
    )
  })

  it('should map a network error during the binary PUT', async () => {
    fetchMock = mockFetch((url) => {
      if (url === UPLOAD_URL) throw new TypeError('socket hang up')
      return jsonResponse({
        value: { uploadUrl: UPLOAD_URL, image: 'urn:li:image:1' },
      })
    })
    expectErr(
      await publishPost('u1', 'ws1', { text: 'x' }, image()),
      'CRM_SOCIAL_OAUTH_FAILED',
    )
  })

  it('should fail when the Posts API rejects the post', async () => {
    fetchMock = route({ post: () => textResponse('422', { status: 422 }) })
    expectErr(
      await publishPost('u1', 'ws1', { text: 'x' }),
      'CRM_SOCIAL_OAUTH_FAILED',
    )
  })

  it('should map a network error on the Posts API', async () => {
    fetchMock = mockFetch(() => {
      throw new TypeError('fetch failed')
    })
    expectErr(
      await publishPost('u1', 'ws1', { text: 'x' }),
      'CRM_SOCIAL_OAUTH_FAILED',
    )
  })

  it.each([
    ['unknown', 'unknown'],
    ['empty', ''],
  ])('should reject a connection with an %s person id', async (_, personId) => {
    withToken({ scope: ALL_SCOPES, externalAccountId: personId })
    expectErr(
      await publishPost('u1', 'ws1', { text: 'x' }),
      'CRM_SOCIAL_CONNECTION_NOT_FOUND',
    )
    expect(fetchMock.spy).not.toHaveBeenCalled()
  })
})

describe('deletePost()', () => {
  beforeEach(() => {
    asMember('OWNER')
  })

  it('should DELETE the post by its encoded URN', async () => {
    fetchMock = mockFetch(() => new Response(null, { status: 204 }))

    expect(expectOk(await deletePost('u1', 'ws1', 'urn:li:share:1'))).toEqual({
      deletedId: 'urn:li:share:1',
    })
    const [call] = fetchMock.calls()
    expect(call.url).toBe(`${REST}/posts/urn%3Ali%3Ashare%3A1`)
    expect(call.init?.method).toBe('DELETE')
    expect(headerOf(call, 'LinkedIn-Version')).toBe('202404')
  })

  it('should fail on a 404', async () => {
    fetchMock = mockFetch(() => textResponse('', { status: 404 }))
    expectErr(
      await deletePost('u1', 'ws1', 'urn:li:share:1'),
      'CRM_SOCIAL_OAUTH_FAILED',
    )
  })

  it('should map a network error', async () => {
    fetchMock = mockFetch(() => {
      throw new TypeError('fetch failed')
    })
    expectErr(
      await deletePost('u1', 'ws1', 'urn:li:share:1'),
      'CRM_SOCIAL_OAUTH_FAILED',
    )
  })
})
