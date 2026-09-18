import type { Job } from 'bullmq'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  getObject: vi.fn(),
  deleteObject: vi.fn(),
  normalizeFacebookVideo: vi.fn(),
  normalizeInstagramVideo: vi.fn(),
  publishYoutubeVideo: vi.fn(),
  publishInstagramPost: vi.fn(),
  publishFacebookPost: vi.fn(),
}))

vi.mock('@/lib/axiom/logger', () => ({ logger: mocks.loggerMock }))
vi.mock('@/src/lib/storage/s3', () => ({
  getObject: mocks.getObject,
  deleteObject: mocks.deleteObject,
}))
vi.mock('@/src/lib/social/video-normalize', () => ({
  normalizeFacebookVideo: mocks.normalizeFacebookVideo,
  normalizeInstagramVideo: mocks.normalizeInstagramVideo,
}))
vi.mock('@/src/services/crm-social-youtube.service', () => ({
  publishVideo: mocks.publishYoutubeVideo,
}))
vi.mock('@/src/services/crm-social-instagram.service', () => ({
  publishPost: mocks.publishInstagramPost,
}))
vi.mock('@/src/services/crm-social-facebook.service', () => ({
  publishPost: mocks.publishFacebookPost,
}))

import { CrmSocialPublishJob } from '@/src/lib/queue/jobs'
import {
  CRM_SOCIAL_PUBLISH_TMP_BUCKET,
  processCrmSocialPublish,
} from '@/src/lib/queue/processors/crm-social-publish'

function job(name: string, data: Record<string, unknown> = {}): Job {
  return { id: 'job-1', name, data } as unknown as Job
}

const domainError = {
  ok: false,
  error: { code: 'CRM_SOCIAL_SCOPE_MISSING', message: 'Reconecte a conta' },
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getObject.mockImplementation(async ({ key }: { key: string }) =>
    Buffer.from(`bytes:${key}`),
  )
  mocks.deleteObject.mockResolvedValue(undefined)
})

describe('processCrmSocialPublish — YouTube', () => {
  const data = {
    actorId: 'user-1',
    workspaceId: 'ws-1',
    objectKey: 'tmp/video.mp4',
    contentType: 'video/mp4',
    title: 'Demo',
    description: 'desc',
    tags: ['a'],
    privacyStatus: 'unlisted',
  }

  it('publishes the uploaded bytes and deletes the temp object', async () => {
    mocks.publishYoutubeVideo.mockResolvedValue({
      ok: true,
      value: { videoId: 'yt-1' },
    })

    const result = await processCrmSocialPublish(
      job(CrmSocialPublishJob.PublishYoutubeVideo, data),
    )

    expect(result).toEqual({ ok: true, value: { videoId: 'yt-1' } })
    expect(mocks.getObject).toHaveBeenCalledWith({
      bucket: CRM_SOCIAL_PUBLISH_TMP_BUCKET,
      key: 'tmp/video.mp4',
    })
    const [actor, ws, input, media] = mocks.publishYoutubeVideo.mock.calls[0]
    expect(actor).toBe('user-1')
    expect(ws).toBe('ws-1')
    expect(input).toEqual({
      title: 'Demo',
      description: 'desc',
      tags: ['a'],
      privacyStatus: 'unlisted',
    })
    expect(media.contentType).toBe('video/mp4')
    expect(media.bytes).toBeInstanceOf(ArrayBuffer)
    expect(Buffer.from(media.bytes).toString()).toBe('bytes:tmp/video.mp4')
    expect(mocks.deleteObject).toHaveBeenCalledWith({
      bucket: CRM_SOCIAL_PUBLISH_TMP_BUCKET,
      key: 'tmp/video.mp4',
    })
  })

  it('returns the domain error code instead of throwing', async () => {
    mocks.publishYoutubeVideo.mockResolvedValue(domainError)

    const result = await processCrmSocialPublish(
      job(CrmSocialPublishJob.PublishYoutubeVideo, data),
    )

    expect(result).toEqual({
      ok: false,
      code: 'CRM_SOCIAL_SCOPE_MISSING',
      message: 'Reconecte a conta',
    })
    expect(mocks.deleteObject).toHaveBeenCalledTimes(1)
  })

  it('still cleans up (and logs cleanup failures) when reading the object throws', async () => {
    mocks.getObject.mockRejectedValue(new Error('minio down'))
    mocks.deleteObject.mockRejectedValue(new Error('delete failed'))

    await expect(
      processCrmSocialPublish(
        job(CrmSocialPublishJob.PublishYoutubeVideo, data),
      ),
    ).rejects.toThrow('minio down')
    expect(mocks.loggerMock.error).toHaveBeenCalledWith(
      'queue.crm_social_publish.tmp_cleanup_failed',
      expect.objectContaining({
        objectKey: 'tmp/video.mp4',
        message: 'delete failed',
      }),
    )
  })

  it('stringifies non-Error cleanup failures', async () => {
    mocks.publishYoutubeVideo.mockResolvedValue({ ok: true, value: {} })
    mocks.deleteObject.mockRejectedValue('nope')

    await processCrmSocialPublish(
      job(CrmSocialPublishJob.PublishYoutubeVideo, data),
    )

    expect(mocks.loggerMock.error).toHaveBeenCalledWith(
      'queue.crm_social_publish.tmp_cleanup_failed',
      expect.objectContaining({ message: 'nope' }),
    )
  })
})

describe('processCrmSocialPublish — Instagram', () => {
  const base = {
    actorId: 'user-1',
    workspaceId: 'ws-1',
    connectionId: 'conn-1',
    objectKey: 'tmp/media',
    contentType: 'image/png',
    caption: 'Oi',
    postType: 'FEED',
  }

  it('publishes an image as-is without a cover', async () => {
    mocks.publishInstagramPost.mockResolvedValue({
      ok: true,
      value: { mediaId: 'ig-1' },
    })

    const result = await processCrmSocialPublish(
      job(CrmSocialPublishJob.PublishInstagramMedia, {
        ...base,
        kind: 'IMAGE',
      }),
    )

    expect(result).toEqual({ ok: true, value: { mediaId: 'ig-1' } })
    expect(mocks.normalizeInstagramVideo).not.toHaveBeenCalled()
    const [, , input, media, connectionId, cover] =
      mocks.publishInstagramPost.mock.calls[0]
    expect(input).toEqual({ caption: 'Oi', postType: 'FEED' })
    expect(media.contentType).toBe('image/png')
    expect(media.kind).toBe('IMAGE')
    expect(connectionId).toBe('conn-1')
    expect(cover).toBeNull()
    expect(mocks.deleteObject).toHaveBeenCalledTimes(1)
  })

  it('normalizes videos to mp4 and attaches the reel cover (default jpeg)', async () => {
    const normalized = new ArrayBuffer(4)
    mocks.normalizeInstagramVideo.mockResolvedValue({
      ok: true,
      value: normalized,
    })
    mocks.publishInstagramPost.mockResolvedValue({ ok: true, value: {} })

    await processCrmSocialPublish(
      job(CrmSocialPublishJob.PublishInstagramMedia, {
        ...base,
        contentType: 'video/quicktime',
        kind: 'VIDEO',
        postType: 'REELS',
        coverObjectKey: 'tmp/cover',
      }),
    )

    expect(mocks.normalizeInstagramVideo).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      'REELS',
    )
    const [, , , media, , cover] = mocks.publishInstagramPost.mock.calls[0]
    expect(media).toEqual({
      bytes: normalized,
      contentType: 'video/mp4',
      kind: 'VIDEO',
    })
    expect(cover.contentType).toBe('image/jpeg')
    expect(Buffer.from(cover.bytes).toString()).toBe('bytes:tmp/cover')
    expect(mocks.deleteObject).toHaveBeenCalledWith({
      bucket: CRM_SOCIAL_PUBLISH_TMP_BUCKET,
      key: 'tmp/cover',
    })
    expect(mocks.deleteObject).toHaveBeenCalledTimes(2)
  })

  it('keeps an explicit cover content type', async () => {
    mocks.publishInstagramPost.mockResolvedValue({ ok: true, value: {} })

    await processCrmSocialPublish(
      job(CrmSocialPublishJob.PublishInstagramMedia, {
        ...base,
        kind: 'IMAGE',
        coverObjectKey: 'tmp/cover',
        coverContentType: 'image/png',
      }),
    )

    const cover = mocks.publishInstagramPost.mock.calls[0][5]
    expect(cover.contentType).toBe('image/png')
  })

  it('returns the normalization error without publishing', async () => {
    mocks.normalizeInstagramVideo.mockResolvedValue({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'vídeo inválido' },
    })

    const result = await processCrmSocialPublish(
      job(CrmSocialPublishJob.PublishInstagramMedia, {
        ...base,
        kind: 'VIDEO',
      }),
    )

    expect(result).toEqual({
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'vídeo inválido',
    })
    expect(mocks.publishInstagramPost).not.toHaveBeenCalled()
    expect(mocks.deleteObject).toHaveBeenCalledTimes(1)
  })

  it('returns the publish domain error and logs failed cleanup of media and cover', async () => {
    mocks.publishInstagramPost.mockResolvedValue(domainError)
    mocks.deleteObject
      .mockRejectedValueOnce(new Error('media cleanup'))
      .mockRejectedValueOnce('cover cleanup')

    const result = await processCrmSocialPublish(
      job(CrmSocialPublishJob.PublishInstagramMedia, {
        ...base,
        kind: 'IMAGE',
        coverObjectKey: 'tmp/cover',
      }),
    )

    expect(result).toEqual({
      ok: false,
      code: 'CRM_SOCIAL_SCOPE_MISSING',
      message: 'Reconecte a conta',
    })
    expect(mocks.loggerMock.error).toHaveBeenCalledWith(
      'queue.crm_social_publish.tmp_cleanup_failed',
      expect.objectContaining({
        objectKey: 'tmp/media',
        message: 'media cleanup',
      }),
    )
    expect(mocks.loggerMock.error).toHaveBeenCalledWith(
      'queue.crm_social_publish.tmp_cleanup_failed',
      expect.objectContaining({
        objectKey: 'tmp/cover',
        message: 'cover cleanup',
      }),
    )
  })

  it('logs Error instances from a failed cover cleanup', async () => {
    mocks.publishInstagramPost.mockResolvedValue({ ok: true, value: {} })
    mocks.deleteObject
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('cover gone'))

    await processCrmSocialPublish(
      job(CrmSocialPublishJob.PublishInstagramMedia, {
        ...base,
        kind: 'IMAGE',
        coverObjectKey: 'tmp/cover',
      }),
    )

    expect(mocks.loggerMock.error).toHaveBeenCalledWith(
      'queue.crm_social_publish.tmp_cleanup_failed',
      expect.objectContaining({
        objectKey: 'tmp/cover',
        message: 'cover gone',
      }),
    )
  })

  it('stringifies non-Error media cleanup failures', async () => {
    mocks.publishInstagramPost.mockResolvedValue({ ok: true, value: {} })
    mocks.deleteObject.mockRejectedValueOnce(42)

    await processCrmSocialPublish(
      job(CrmSocialPublishJob.PublishInstagramMedia, {
        ...base,
        kind: 'IMAGE',
      }),
    )

    expect(mocks.loggerMock.error).toHaveBeenCalledWith(
      'queue.crm_social_publish.tmp_cleanup_failed',
      expect.objectContaining({ objectKey: 'tmp/media', message: '42' }),
    )
  })
})

describe('processCrmSocialPublish — Facebook', () => {
  const data = {
    actorId: 'user-1',
    workspaceId: 'ws-1',
    connectionId: 'conn-1',
    objectKey: 'tmp/fb.mov',
    contentType: 'video/quicktime',
    message: 'Olá',
    link: null,
  }

  it('normalizes and publishes the video', async () => {
    const normalized = new ArrayBuffer(8)
    mocks.normalizeFacebookVideo.mockResolvedValue({
      ok: true,
      value: normalized,
    })
    mocks.publishFacebookPost.mockResolvedValue({
      ok: true,
      value: { postId: 'fb-1' },
    })

    const result = await processCrmSocialPublish(
      job(CrmSocialPublishJob.PublishFacebookVideo, data),
    )

    expect(result).toEqual({ ok: true, value: { postId: 'fb-1' } })
    expect(mocks.publishFacebookPost).toHaveBeenCalledWith(
      'user-1',
      'ws-1',
      { message: 'Olá', link: null },
      { bytes: normalized, contentType: 'video/mp4', kind: 'VIDEO' },
      'conn-1',
    )
    expect(mocks.deleteObject).toHaveBeenCalledWith({
      bucket: CRM_SOCIAL_PUBLISH_TMP_BUCKET,
      key: 'tmp/fb.mov',
    })
  })

  it('returns the normalization error without publishing', async () => {
    mocks.normalizeFacebookVideo.mockResolvedValue({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'ffmpeg falhou' },
    })

    const result = await processCrmSocialPublish(
      job(CrmSocialPublishJob.PublishFacebookVideo, data),
    )

    expect(result).toEqual({
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'ffmpeg falhou',
    })
    expect(mocks.publishFacebookPost).not.toHaveBeenCalled()
  })

  it('returns the publish domain error and logs cleanup failures', async () => {
    mocks.normalizeFacebookVideo.mockResolvedValue({
      ok: true,
      value: new ArrayBuffer(1),
    })
    mocks.publishFacebookPost.mockResolvedValue(domainError)
    mocks.deleteObject.mockRejectedValueOnce(new Error('gone'))

    const result = await processCrmSocialPublish(
      job(CrmSocialPublishJob.PublishFacebookVideo, data),
    )

    expect(result).toMatchObject({
      ok: false,
      code: 'CRM_SOCIAL_SCOPE_MISSING',
    })
    expect(mocks.loggerMock.error).toHaveBeenCalledWith(
      'queue.crm_social_publish.tmp_cleanup_failed',
      expect.objectContaining({ objectKey: 'tmp/fb.mov', message: 'gone' }),
    )
  })

  it('stringifies non-Error cleanup failures', async () => {
    mocks.normalizeFacebookVideo.mockResolvedValue({
      ok: true,
      value: new ArrayBuffer(1),
    })
    mocks.publishFacebookPost.mockResolvedValue({ ok: true, value: {} })
    mocks.deleteObject.mockRejectedValueOnce('x')

    await processCrmSocialPublish(
      job(CrmSocialPublishJob.PublishFacebookVideo, data),
    )

    expect(mocks.loggerMock.error).toHaveBeenCalledWith(
      'queue.crm_social_publish.tmp_cleanup_failed',
      expect.objectContaining({ message: 'x' }),
    )
  })
})

describe('processCrmSocialPublish — routing', () => {
  it('throws on an unknown job name', async () => {
    await expect(processCrmSocialPublish(job('nope'))).rejects.toThrow(
      'Unknown crm-social-publish job: nope (id=job-1)',
    )
  })
})
