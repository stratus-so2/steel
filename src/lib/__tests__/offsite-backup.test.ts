import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

const { sendMock, envMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  envMock: {
    BACKUP_OFFSITE_ENDPOINT: 'https://s3.offsite.example' as string | undefined,
    BACKUP_OFFSITE_REGION: 'us-east-005' as string | undefined,
    BACKUP_OFFSITE_BUCKET: 'steel-offsite' as string | undefined,
    BACKUP_OFFSITE_ACCESS_KEY_ID: 'key-id' as string | undefined,
    BACKUP_OFFSITE_SECRET_ACCESS_KEY: 'secret' as string | undefined,
    BACKUP_OFFSITE_PREFIX: undefined as string | undefined,
    BACKUP_OFFSITE_FORCE_PATH_STYLE: undefined as string | undefined,
    BACKUP_OFFSITE_SSE: undefined as string | undefined,
    BACKUP_OFFSITE_RETENTION_DAYS: '30' as string | undefined,
  },
}))

vi.mock('@/lib/env/server', () => envMock)
vi.mock('@aws-sdk/client-s3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aws-sdk/client-s3')>()
  return {
    ...actual,
    S3Client: class {
      send = sendMock
    },
  }
})

import {
  getOffsiteConfig,
  pruneOffsiteObjects,
  uploadAndVerifyOffsite,
} from '@/src/lib/storage/offsite-backup'

type SentCommand = {
  constructor: { name: string }
  input: Record<string, unknown>
}

function sent(): SentCommand[] {
  return sendMock.mock.calls.map((call) => call[0] as SentCommand)
}

async function* streamOf(buffer: Buffer) {
  yield new Uint8Array(buffer)
}

function sha(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

describe('getOffsiteConfig', () => {
  it('returns null (inert) when endpoint/bucket/keys are missing', () => {
    const saved = envMock.BACKUP_OFFSITE_BUCKET
    envMock.BACKUP_OFFSITE_BUCKET = undefined
    try {
      expect(getOffsiteConfig()).toBeNull()
    } finally {
      envMock.BACKUP_OFFSITE_BUCKET = saved
    }
  })

  it('applies defaults: steel/ prefix, SSE on, path-style off', () => {
    const config = getOffsiteConfig()
    expect(config).toMatchObject({
      bucket: 'steel-offsite',
      prefix: 'steel/',
      serverSideEncryption: true,
      forcePathStyle: false,
      retentionDays: 30,
    })
  })

  it('lets BACKUP_OFFSITE_SSE=false turn provider-side encryption off', () => {
    envMock.BACKUP_OFFSITE_SSE = 'false'
    try {
      expect(getOffsiteConfig()?.serverSideEncryption).toBe(false)
    } finally {
      envMock.BACKUP_OFFSITE_SSE = undefined
    }
  })
})

describe('uploadAndVerifyOffsite', () => {
  const body = Buffer.from('encrypted-envelope')

  it('uploads with SSE + checksum metadata and verifies by reading back', async () => {
    sendMock
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ ContentLength: body.length })
      .mockResolvedValueOnce({ Body: streamOf(body) })

    const config = getOffsiteConfig()
    if (!config) throw new Error('config expected')
    const result = await uploadAndVerifyOffsite(config, {
      key: 'full/b1.dump.enc',
      body,
      plainChecksum: 'plain-sha',
    })

    expect(result).toEqual({
      key: 'steel/full/b1.dump.enc',
      sizeBytes: body.length,
      encryptedChecksum: sha(body),
    })
    const [put, head, get] = sent()
    expect(put.constructor.name).toBe('PutObjectCommand')
    expect(put.input).toMatchObject({
      Bucket: 'steel-offsite',
      Key: 'steel/full/b1.dump.enc',
      ServerSideEncryption: 'AES256',
      Metadata: { 'sha256-encrypted': sha(body), 'sha256-plain': 'plain-sha' },
    })
    expect(head.constructor.name).toBe('HeadObjectCommand')
    expect(get.constructor.name).toBe('GetObjectCommand')
  })

  it('fails verification when the stored size differs', async () => {
    sendMock
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ ContentLength: body.length - 1 })

    const config = getOffsiteConfig()
    if (!config) throw new Error('config expected')
    await expect(
      uploadAndVerifyOffsite(config, {
        key: 'full/b1.dump.enc',
        body,
        plainChecksum: null,
      }),
    ).rejects.toThrow(/size/)
  })

  it('fails verification when the read-back content differs', async () => {
    sendMock
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ ContentLength: body.length })
      .mockResolvedValueOnce({
        Body: streamOf(Buffer.from('tampered-envelop')),
      })

    const config = getOffsiteConfig()
    if (!config) throw new Error('config expected')
    await expect(
      uploadAndVerifyOffsite(config, {
        key: 'full/b1.dump.enc',
        body,
        plainChecksum: null,
      }),
    ).rejects.toThrow(/sha256/)
  })
})

describe('pruneOffsiteObjects', () => {
  it('deletes only copies older than the retention window', async () => {
    const now = new Date('2026-09-18T12:00:00Z')
    sendMock
      .mockResolvedValueOnce({
        Contents: [
          {
            Key: 'steel/full/old.dump.enc',
            Size: 10,
            LastModified: new Date('2026-08-01T00:00:00Z'),
          },
          {
            Key: 'steel/full/new.dump.enc',
            Size: 10,
            LastModified: new Date('2026-09-17T00:00:00Z'),
          },
        ],
        IsTruncated: false,
      })
      .mockResolvedValueOnce({})

    const config = getOffsiteConfig()
    if (!config) throw new Error('config expected')
    const count = await pruneOffsiteObjects(config, now)

    expect(count).toBe(1)
    const deletes = sent().filter(
      (c) => c.constructor.name === 'DeleteObjectCommand',
    )
    expect(deletes).toHaveLength(1)
    expect(deletes[0].input).toMatchObject({
      Bucket: 'steel-offsite',
      Key: 'steel/full/old.dump.enc',
    })
  })
})
