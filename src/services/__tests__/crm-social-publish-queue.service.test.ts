import { beforeEach, describe, expect, it, vi } from 'vitest'
import { asMember } from '@/src/__tests__/helpers/crm-social.helpers'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { forbidden } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/services/crm-social-token')
vi.mock('@/src/lib/consent', () => ({ requireConsent: vi.fn() }))
vi.mock('@/src/lib/storage/s3', () => ({
  ensureBucket: vi.fn(),
  putObject: vi.fn(),
}))
const { add } = vi.hoisted(() => ({ add: vi.fn() }))
vi.mock('@/src/lib/queue/queues', () => ({
  getCrmSocialPublishQueue: () => ({ add }),
}))

import { requireConsent } from '@/src/lib/consent'
import { CrmSocialPublishJob } from '@/src/lib/queue/jobs'
import { putObject } from '@/src/lib/storage/s3'
import { enqueuePublish } from '../crm-social-publish-queue.service'

const media = {
  bytes: new Uint8Array([1, 2, 3]).buffer,
  contentType: 'video/mp4',
}

function enqueueFacebookVideo() {
  return enqueuePublish(
    'u1',
    'ws1',
    CrmSocialPublishJob.PublishFacebookVideo,
    { message: 'Oi', link: null },
    media,
  )
}

beforeEach(() => {
  vi.mocked(requireConsent).mockResolvedValue(ok(true as const))
  vi.mocked(putObject).mockResolvedValue(undefined)
  add.mockResolvedValue({ id: 'job-1' })
  asMember('MEMBER')
})

describe('enqueuePublish()', () => {
  it('should store the media and enqueue the job with the owner', async () => {
    const result = await enqueueFacebookVideo()

    expect(expectOk(result)).toEqual({ jobId: 'job-1' })
    expect(add).toHaveBeenCalledWith(
      CrmSocialPublishJob.PublishFacebookVideo,
      expect.objectContaining({
        actorId: 'u1',
        workspaceId: 'ws1',
        contentType: 'video/mp4',
        message: 'Oi',
        objectKey: expect.stringMatching(/^ws1\//),
      }),
      { attempts: 1 },
    )
  })

  it('should store the Reels cover next to the media', async () => {
    const result = await enqueuePublish(
      'u1',
      'ws1',
      CrmSocialPublishJob.PublishInstagramMedia,
      { kind: 'VIDEO', caption: 'c', postType: 'REELS' },
      media,
      { bytes: new Uint8Array([9]).buffer, contentType: 'image/png' },
    )

    expectOk(result)
    expect(putObject).toHaveBeenCalledTimes(2)
    expect(add.mock.calls[0][1]).toMatchObject({
      coverObjectKey: expect.stringMatching(/^ws1\//),
      coverContentType: 'image/png',
    })
  })

  it('should return FORBIDDEN without consent and never store or enqueue', async () => {
    vi.mocked(requireConsent).mockResolvedValue(
      err(forbidden('Consentimento obrigatório')),
    )

    expectErr(await enqueueFacebookVideo(), 'FORBIDDEN')
    expect(putObject).not.toHaveBeenCalled()
    expect(add).not.toHaveBeenCalled()
  })

  it('should return FORBIDDEN for a VIEWER (no CREATE on social) before enqueuing', async () => {
    asMember('VIEWER')

    expectErr(await enqueueFacebookVideo(), 'FORBIDDEN')
    expect(putObject).not.toHaveBeenCalled()
    expect(add).not.toHaveBeenCalled()
  })

  it('should return STORAGE_ERROR when the tmp upload fails', async () => {
    vi.mocked(putObject).mockRejectedValue(new Error('minio down'))

    expectErr(await enqueueFacebookVideo(), 'STORAGE_ERROR')
    expect(add).not.toHaveBeenCalled()
  })
})
