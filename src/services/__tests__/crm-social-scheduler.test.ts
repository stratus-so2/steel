import type { CrmScheduledPostMedia } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeCrmScheduledPost,
  createFakeCrmScheduledPostTarget,
} from '@/src/__tests__/factories/crm-social.factory'
import { ok } from '@/src/lib/result'
import type { CrmScheduledPostWithRelations } from '@/src/repositories/crm-social.repository'

vi.mock('@/src/repositories/crm-social.repository')
vi.mock('@/src/lib/storage/s3', () => ({ getObject: vi.fn() }))
vi.mock('@/lib/axiom/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))
vi.mock('../crm-social-publisher', () => ({
  publishToSocialPlatform: vi.fn(),
}))

import { logger } from '@/lib/axiom/logger'
import { getObject } from '@/src/lib/storage/s3'
import {
  CrmScheduledPostRepository,
  CrmScheduledPostTargetRepository,
} from '@/src/repositories/crm-social.repository'
import { publishToSocialPlatform } from '../crm-social-publisher'
import {
  CRM_SCHEDULED_POST_BUCKET,
  publishScheduledPost,
} from '../crm-social-scheduler'

const mockedGetObject = vi.mocked(getObject)
const mockedPublish = vi.mocked(publishToSocialPlatform)
const mockedPostRepo = vi.mocked(CrmScheduledPostRepository)
const mockedTargetRepo = vi.mocked(CrmScheduledPostTargetRepository)

function media(
  kind: 'IMAGE' | 'VIDEO',
  storageKey: string,
  contentType: string,
): CrmScheduledPostMedia {
  return {
    id: `m-${storageKey}`,
    postId: 'p1',
    kind,
    storageKey,
    contentType,
    sizeBytes: 3,
    order: 0,
    createdAt: new Date(),
  }
}

function post(
  overrides: Partial<CrmScheduledPostWithRelations> = {},
): CrmScheduledPostWithRelations {
  return {
    ...createFakeCrmScheduledPost({
      id: 'p1',
      workspaceId: 'ws1',
      createdById: 'author',
      content: 'Olá',
      title: 'Título',
      options: { youtube: { privacy: 'public' } },
      status: 'SCHEDULED',
    }),
    targets: [],
    media: [],
    ...overrides,
  }
}

beforeEach(() => {
  mockedPostRepo.setStatus.mockResolvedValue(ok(createFakeCrmScheduledPost()))
  mockedTargetRepo.setStatus.mockResolvedValue(
    ok(createFakeCrmScheduledPostTarget()),
  )
})

describe('publishScheduledPost()', () => {
  it('should load the first image and video once and pass them to every target', async () => {
    // Buffers vindos de um pool compartilhado têm byteOffset > 0.
    const pool = Buffer.from([9, 9, 1, 2, 3, 9])
    mockedGetObject.mockImplementation(async ({ key }) =>
      key === 'img.png' ? pool.subarray(2, 5) : Buffer.from([7, 7]),
    )
    mockedPublish.mockResolvedValue({ ok: true, externalPostId: 'ext-1' })
    const t1 = createFakeCrmScheduledPostTarget({
      id: 't1',
      platform: 'FACEBOOK',
      attempts: 0,
    })
    const t2 = createFakeCrmScheduledPostTarget({
      id: 't2',
      platform: 'YOUTUBE',
      attempts: 2,
    })

    await publishScheduledPost(
      post({
        targets: [t1, t2],
        media: [
          media('IMAGE', 'img.png', 'image/png'),
          media('IMAGE', 'img-2.png', 'image/png'),
          media('VIDEO', 'vid.mp4', 'video/mp4'),
        ],
      }),
    )

    expect(mockedGetObject).toHaveBeenCalledTimes(2)
    expect(mockedGetObject).toHaveBeenCalledWith({
      bucket: CRM_SCHEDULED_POST_BUCKET,
      key: 'img.png',
    })
    expect(mockedGetObject).toHaveBeenCalledWith({
      bucket: CRM_SCHEDULED_POST_BUCKET,
      key: 'vid.mp4',
    })
    const ctx = mockedPublish.mock.calls[0][1]
    expect(ctx).toMatchObject({
      actorId: 'author',
      workspaceId: 'ws1',
      content: 'Olá',
      title: 'Título',
      options: { youtube: { privacy: 'public' } },
    })
    expect([...new Uint8Array(ctx.image?.bytes as ArrayBuffer)]).toEqual([
      1, 2, 3,
    ])
    expect(ctx.image?.contentType).toBe('image/png')
    expect(ctx.video?.contentType).toBe('video/mp4')
    expect(mockedPublish.mock.calls.map((c) => c[0])).toEqual([
      'FACEBOOK',
      'YOUTUBE',
    ])
    expect(mockedTargetRepo.setStatus).toHaveBeenCalledWith(
      't1',
      'PUBLISHING',
      {
        attempts: 1,
      },
    )
    expect(mockedTargetRepo.setStatus).toHaveBeenCalledWith(
      't2',
      'PUBLISHING',
      {
        attempts: 3,
      },
    )
    expect(mockedTargetRepo.setStatus).toHaveBeenCalledWith('t1', 'PUBLISHED', {
      externalPostId: 'ext-1',
      error: null,
      publishedAt: expect.any(Date),
    })
    expect(mockedPostRepo.setStatus).toHaveBeenCalledWith('p1', 'PUBLISHED', {
      publishedAt: expect.any(Date),
      lastError: null,
    })
  })

  it('should download a storage key shared by image and video only once', async () => {
    mockedGetObject.mockResolvedValue(Buffer.from([1]))
    mockedPublish.mockResolvedValue({ ok: true, externalPostId: 'x' })

    await publishScheduledPost(
      post({
        targets: [createFakeCrmScheduledPostTarget()],
        media: [
          media('IMAGE', 'same', 'image/gif'),
          media('VIDEO', 'same', 'image/gif'),
        ],
      }),
    )

    expect(mockedGetObject).toHaveBeenCalledTimes(1)
    const ctx = mockedPublish.mock.calls[0][1]
    expect(ctx.video).toBe(ctx.image)
  })

  it('should publish without media and tolerate missing relations', async () => {
    await publishScheduledPost(
      post({
        media: undefined as unknown as CrmScheduledPostMedia[],
        targets:
          undefined as unknown as CrmScheduledPostWithRelations['targets'],
      }),
    )

    expect(mockedGetObject).not.toHaveBeenCalled()
    expect(mockedPublish).not.toHaveBeenCalled()
    expect(mockedPostRepo.setStatus).toHaveBeenCalledWith('p1', 'PUBLISHED', {
      publishedAt: expect.any(Date),
      lastError: null,
    })
  })

  it.each([
    ['an Error', new Error('NoSuchKey'), 'NoSuchKey'],
    ['a non-Error value', 'timeout', 'timeout'],
  ])('should fail the whole post when media loading throws %s', async (_, thrown, message) => {
    mockedGetObject.mockRejectedValue(thrown)

    await publishScheduledPost(
      post({
        targets: [createFakeCrmScheduledPostTarget()],
        media: [media('VIDEO', 'v', 'video/mp4')],
      }),
    )

    expect(logger.error).toHaveBeenCalledWith(
      'crm_social_scheduler.media_load_failed',
      expect.objectContaining({ postId: 'p1', message }),
    )
    expect(mockedPostRepo.setStatus).toHaveBeenCalledWith('p1', 'FAILED', {
      lastError: 'Falha ao carregar a mídia do armazenamento',
    })
    expect(mockedPublish).not.toHaveBeenCalled()
    expect(mockedTargetRepo.setStatus).not.toHaveBeenCalled()
  })

  it('should skip PUBLISHED/CANCELED targets and mark a partial failure', async () => {
    mockedPublish
      .mockResolvedValueOnce({ ok: false, error: 'Token expirado' })
      .mockResolvedValueOnce({ ok: false, error: 'Outro erro' })

    await publishScheduledPost(
      post({
        targets: [
          createFakeCrmScheduledPostTarget({ id: 'done', status: 'PUBLISHED' }),
          createFakeCrmScheduledPostTarget({ id: 'off', status: 'CANCELED' }),
          createFakeCrmScheduledPostTarget({ id: 'retry', status: 'FAILED' }),
          createFakeCrmScheduledPostTarget({ id: 'new', status: 'PENDING' }),
        ],
      }),
    )

    expect(mockedPublish).toHaveBeenCalledTimes(2)
    expect(mockedTargetRepo.setStatus).not.toHaveBeenCalledWith(
      'done',
      expect.anything(),
      expect.anything(),
    )
    expect(mockedTargetRepo.setStatus).toHaveBeenCalledWith('retry', 'FAILED', {
      error: 'Token expirado',
    })
    expect(mockedTargetRepo.setStatus).toHaveBeenCalledWith('new', 'FAILED', {
      error: 'Outro erro',
    })
    expect(mockedPostRepo.setStatus).toHaveBeenCalledWith(
      'p1',
      'PARTIALLY_FAILED',
      { publishedAt: expect.any(Date), lastError: 'Token expirado' },
    )
  })

  it('should mark the post FAILED with no publish date when every target fails', async () => {
    mockedPublish.mockResolvedValue({ ok: false, error: 'Sem mídia' })

    await publishScheduledPost(
      post({
        targets: [
          createFakeCrmScheduledPostTarget({ id: 'a' }),
          createFakeCrmScheduledPostTarget({ id: 'b', status: 'CANCELED' }),
        ],
      }),
    )

    expect(mockedPostRepo.setStatus).toHaveBeenCalledWith('p1', 'FAILED', {
      publishedAt: null,
      lastError: 'Sem mídia',
    })
  })
})
