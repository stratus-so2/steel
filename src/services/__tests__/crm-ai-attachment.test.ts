import { describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'

vi.mock('@/src/lib/storage/s3')

import {
  ensureBucket,
  getPresignedDownloadUrl,
  putObject,
} from '@/src/lib/storage/s3'
import {
  classifyAttachment,
  getAttachmentDownloadUrl,
  storeAttachment,
} from '../crm-ai-attachment'

const mockedEnsureBucket = vi.mocked(ensureBucket)
const mockedPutObject = vi.mocked(putObject)
const mockedPresign = vi.mocked(getPresignedDownloadUrl)

describe('classifyAttachment()', () => {
  it('should classify images as IMAGE', () => {
    const result = classifyAttachment('image/png', 1024)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.kind).toBe('IMAGE')
      expect(result.value.ext).toBe('png')
    }
  })

  it('should classify pdf as DOCUMENT', () => {
    const result = classifyAttachment('application/pdf', 1024)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.kind).toBe('DOCUMENT')
  })

  it('should classify plain text as a txt DOCUMENT', () => {
    expect(expectOk(classifyAttachment('text/plain', 10))).toEqual({
      kind: 'DOCUMENT',
      ext: 'txt',
    })
  })

  it('should accept a file of exactly 10MB', () => {
    expect(
      expectOk(classifyAttachment('image/webp', 10 * 1024 * 1024)).ext,
    ).toBe('webp')
  })

  it('should reject an unsupported content type', () => {
    expect(classifyAttachment('video/mp4', 1024).ok).toBe(false)
  })

  it('should reject files over 10MB', () => {
    expect(classifyAttachment('image/png', 11 * 1024 * 1024).ok).toBe(false)
  })
})

describe('storeAttachment()', () => {
  it('should upload under the conversation prefix and return the key', async () => {
    mockedEnsureBucket.mockResolvedValue(undefined)
    mockedPutObject.mockResolvedValue(undefined)
    const body = Buffer.from('%PDF')

    const key = expectOk(
      await storeAttachment('conv1', body, 'application/pdf', 'pdf'),
    )

    expect(key).toMatch(/^conv1\/[a-z0-9]+\.pdf$/)
    expect(mockedEnsureBucket).toHaveBeenCalledWith('crm-ai-attachments')
    expect(mockedPutObject).toHaveBeenCalledWith({
      bucket: 'crm-ai-attachments',
      key,
      body,
      contentType: 'application/pdf',
    })
  })

  it('should return STORAGE_ERROR when the upload throws', async () => {
    mockedEnsureBucket.mockResolvedValue(undefined)
    mockedPutObject.mockRejectedValue(new Error('s3 down'))

    expectErr(
      await storeAttachment('conv1', Buffer.from('x'), 'image/png', 'png'),
      'STORAGE_ERROR',
    )
  })

  it('should return STORAGE_ERROR when a non-Error is thrown', async () => {
    mockedEnsureBucket.mockRejectedValue('bucket missing')

    expectErr(
      await storeAttachment('conv1', Buffer.from('x'), 'image/png', 'png'),
      'STORAGE_ERROR',
    )
  })
})

describe('getAttachmentDownloadUrl()', () => {
  it('should presign a 15-minute download url', async () => {
    mockedPresign.mockResolvedValue('https://signed/url')

    expect(await getAttachmentDownloadUrl('conv1/a.png')).toBe(
      'https://signed/url',
    )
    expect(mockedPresign).toHaveBeenCalledWith({
      bucket: 'crm-ai-attachments',
      key: 'conv1/a.png',
      expiresInSeconds: 900,
    })
  })
})
