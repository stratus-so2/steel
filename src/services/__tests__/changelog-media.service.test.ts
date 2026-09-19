import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'

vi.mock('@/src/lib/storage/s3')
vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { logger } from '@/lib/axiom/logger'
import { ensurePublicBucket, putObject } from '@/src/lib/storage/s3'
import { persistChangelogImage } from '../media/changelog-media.service'

const s3Put = vi.mocked(putObject)
const s3Bucket = vi.mocked(ensurePublicBucket)

const input = {
  contentType: 'image/webp',
  byteSize: 2048,
  readBody: async () => Buffer.from('img'),
}

beforeEach(() => {
  vi.clearAllMocks()
  s3Bucket.mockResolvedValue()
  s3Put.mockResolvedValue()
})

describe('persistChangelogImage()', () => {
  it('uploads to the public changelog bucket and returns the URL', async () => {
    const { url } = expectOk(await persistChangelogImage(input))

    expect(url).toMatch(/\/changelog-images\/[\w-]+\.webp$/)
    expect(s3Bucket).toHaveBeenCalledWith('changelog-images')
    expect(s3Put).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'changelog-images',
        contentType: 'image/webp',
        body: Buffer.from('img'),
      }),
    )
  })

  it('rejects unsupported formats without reading the body', async () => {
    const readBody = vi.fn(input.readBody)

    const error = expectErr(
      await persistChangelogImage({
        ...input,
        contentType: 'image/gif',
        readBody,
      }),
    )

    expect(error.code).toBe('VALIDATION_ERROR')
    expect(readBody).not.toHaveBeenCalled()
    expect(s3Put).not.toHaveBeenCalled()
  })

  it('rejects images over 5 MB', async () => {
    const error = expectErr(
      await persistChangelogImage({ ...input, byteSize: 6 * 1024 * 1024 }),
    )

    expect(error.message).toBe('Arquivo muito grande. Máximo 5 MB')
  })

  it('returns a storage error and logs when the upload fails', async () => {
    s3Put.mockRejectedValue(new Error('minio down'))

    const error = expectErr(await persistChangelogImage(input))

    expect(error.code).toBe('STORAGE_ERROR')
    expect(logger.error).toHaveBeenCalledWith(
      'changelog_media.persist_failed',
      expect.objectContaining({
        component: 'ChangelogMediaService',
        bucket: 'changelog-images',
        message: 'minio down',
      }),
    )
  })
})
