import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  ensureBucket: vi.fn(),
  ensurePublicBucket: vi.fn(),
  putObject: vi.fn(),
  getObject: vi.fn(),
  getObjectWithContentType: vi.fn(),
  listObjectKeys: vi.fn(),
  deleteObjects: vi.fn(),
  collectWorkspaceFileRefs: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/src/lib/crypto', () => ({
  encryptConnectionSecret: mocks.encrypt,
  decryptConnectionSecret: mocks.decrypt,
}))
vi.mock('@/src/lib/storage/s3', () => ({
  ensureBucket: mocks.ensureBucket,
  ensurePublicBucket: mocks.ensurePublicBucket,
  putObject: mocks.putObject,
  getObject: mocks.getObject,
  getObjectWithContentType: mocks.getObjectWithContentType,
  listObjectKeys: mocks.listObjectKeys,
  deleteObjects: mocks.deleteObjects,
}))
vi.mock('@/src/lib/storage/workspace-files', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/src/lib/storage/workspace-files')>()
  return { ...actual, collectWorkspaceFileRefs: mocks.collectWorkspaceFileRefs }
})
vi.mock('@/lib/axiom/logger', () => ({ logger: mocks.logger }))

import { BACKUP_BUCKET } from '@/src/lib/queue/backup-bucket'
import {
  archiveWorkspaceFiles,
  deleteWorkspaceFileArchive,
  readWorkspaceFilesManifest,
  restoreWorkspaceFiles,
  type WorkspaceFilesManifest,
  workspaceFilesManifestKey,
} from '@/src/lib/queue/workspace-file-archive'

// A "cifra" do teste é reversível e visível: `enc:<base64>`.
const envelopeOf = (base64: string) => `enc:${base64}`

const client = {} as never

function refs(files: unknown[], missingLegacyKeys = 0) {
  return { files, missingLegacyKeys }
}

const sha = (body: Buffer) => createHash('sha256').update(body).digest('hex')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.encrypt.mockImplementation(async (plain: string) => envelopeOf(plain))
  mocks.decrypt.mockImplementation(async (envelope: string) =>
    envelope.replace(/^enc:/, ''),
  )
  mocks.getObject.mockImplementation(async ({ key }: { key: string }) =>
    Buffer.from(stored.get(key) ?? ''),
  )
  mocks.putObject.mockImplementation(
    async ({ key, body }: { key: string; body: string }) => {
      stored.set(key, body)
    },
  )
})

const stored = new Map<string, string>()

describe('archiveWorkspaceFiles()', () => {
  beforeEach(() => stored.clear())

  it('copies every referenced object encrypted, one at a time, and writes a manifest', async () => {
    mocks.collectWorkspaceFileRefs.mockResolvedValue(
      refs([
        {
          bucket: 'whatsapp-media',
          key: 'ws1/a.ogg',
          sizeBytes: 3,
          legacy: false,
        },
        {
          bucket: 'crm-proposal-images',
          key: 'legacy.png',
          sizeBytes: 5,
          legacy: true,
        },
      ]),
    )
    mocks.getObjectWithContentType.mockImplementation(
      async ({ key }: { key: string }) => ({
        body: Buffer.from(key === 'ws1/a.ogg' ? 'ogg' : 'pngpn'),
        contentType: key === 'ws1/a.ogg' ? 'audio/ogg' : 'image/png',
      }),
    )

    const result = await archiveWorkspaceFiles({
      client,
      workspaceId: 'ws1',
      backupId: 'bk1',
    })

    expect(result).toEqual({
      manifestKey: 'workspace/ws1/bk1.files/manifest.json.enc',
      fileCount: 2,
      fileBytes: 8,
      missingLegacyKeys: 0,
    })
    expect(mocks.ensureBucket).toHaveBeenCalledWith(BACKUP_BUCKET)
    expect(stored.has('workspace/ws1/bk1.files/0.enc')).toBe(true)
    expect(stored.has('workspace/ws1/bk1.files/1.enc')).toBe(true)

    const manifest = await readWorkspaceFilesManifest(result.manifestKey)
    expect(manifest.files).toEqual([
      {
        index: 0,
        bucket: 'whatsapp-media',
        key: 'ws1/a.ogg',
        sizeBytes: 3,
        contentType: 'audio/ogg',
        checksum: sha(Buffer.from('ogg')),
        legacy: false,
      },
      {
        index: 1,
        bucket: 'crm-proposal-images',
        key: 'legacy.png',
        sizeBytes: 5,
        contentType: 'image/png',
        checksum: sha(Buffer.from('pngpn')),
        legacy: true,
      },
    ])
  })

  it('skips an object that vanished between listing and copy, without failing the backup', async () => {
    mocks.collectWorkspaceFileRefs.mockResolvedValue(
      refs(
        [
          {
            bucket: 'whatsapp-media',
            key: 'ws1/gone',
            sizeBytes: 1,
            legacy: false,
          },
          {
            bucket: 'whatsapp-media',
            key: 'ws1/ok',
            sizeBytes: 2,
            legacy: false,
          },
        ],
        3,
      ),
    )
    mocks.getObjectWithContentType.mockImplementation(
      async ({ key }: { key: string }) => {
        if (key === 'ws1/gone') throw new Error('NoSuchKey')
        return { body: Buffer.from('ok'), contentType: 'image/png' }
      },
    )

    const result = await archiveWorkspaceFiles({
      client,
      workspaceId: 'ws1',
      backupId: 'bk1',
      jobId: 'job1',
    })

    expect(result).toMatchObject({ fileCount: 1, missingLegacyKeys: 3 })
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'queue.database_backup.workspace_file_skipped',
      expect.objectContaining({ key: 'ws1/gone', message: 'NoSuchKey' }),
    )
  })

  it('stringifies a non-Error while copying an object', async () => {
    mocks.collectWorkspaceFileRefs.mockResolvedValue(
      refs([
        { bucket: 'whatsapp-media', key: 'ws1/x', sizeBytes: 1, legacy: false },
      ]),
    )
    mocks.getObjectWithContentType.mockRejectedValue('minio down')

    const result = await archiveWorkspaceFiles({
      client,
      workspaceId: 'ws1',
      backupId: 'bk1',
    })

    expect(result.fileCount).toBe(0)
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'queue.database_backup.workspace_file_skipped',
      expect.objectContaining({ message: 'minio down' }),
    )
  })
})

describe('readWorkspaceFilesManifest()', () => {
  beforeEach(() => stored.clear())

  it('rejects a manifest written by a newer format', async () => {
    stored.set(
      'manifest.enc',
      envelopeOf(
        Buffer.from(JSON.stringify({ version: 99, files: [] })).toString(
          'base64',
        ),
      ),
    )

    await expect(readWorkspaceFilesManifest('manifest.enc')).rejects.toThrow(
      /versão não suportada \(99\)/,
    )
  })
})

describe('restoreWorkspaceFiles()', () => {
  const body = Buffer.from('bytes')

  function manifest(
    overrides: Partial<WorkspaceFilesManifest['files'][number]> = {},
  ): WorkspaceFilesManifest {
    return {
      version: 1,
      workspaceId: 'ws1',
      backupId: 'bk1',
      missingLegacyKeys: 0,
      files: [
        {
          index: 0,
          bucket: 'crm-proposal-images',
          key: 'ws1/a.png',
          sizeBytes: body.byteLength,
          contentType: 'image/png',
          checksum: sha(body),
          legacy: false,
          ...overrides,
        },
      ],
    }
  }

  beforeEach(() => {
    stored.clear()
    stored.set(
      'workspace/ws1/bk1.files/0.enc',
      envelopeOf(body.toString('base64')),
    )
  })

  it('writes each object back with its bucket policy and content type', async () => {
    const result = await restoreWorkspaceFiles({ manifest: manifest() })

    expect(result).toEqual({
      restored: 1,
      planned: 1,
      bytes: body.byteLength,
      byBucket: {
        'crm-proposal-images': { files: 1, bytes: body.byteLength },
      },
      dryRun: false,
    })
    expect(mocks.ensurePublicBucket).toHaveBeenCalledWith('crm-proposal-images')
    expect(mocks.putObject).toHaveBeenCalledWith({
      bucket: 'crm-proposal-images',
      key: 'ws1/a.png',
      body,
      contentType: 'image/png',
    })
  })

  it('keeps a private bucket private', async () => {
    await restoreWorkspaceFiles({
      manifest: manifest({ bucket: 'whatsapp-media', key: 'ws1/a.ogg' }),
    })

    expect(mocks.ensureBucket).toHaveBeenCalledWith('whatsapp-media')
    expect(mocks.ensurePublicBucket).not.toHaveBeenCalled()
  })

  it('summarises without writing anything on a dry run', async () => {
    const result = await restoreWorkspaceFiles({
      manifest: manifest(),
      dryRun: true,
    })

    expect(result).toMatchObject({ restored: 0, planned: 1, dryRun: true })
    expect(mocks.putObject).not.toHaveBeenCalled()
    expect(mocks.ensurePublicBucket).not.toHaveBeenCalled()
  })

  it('refuses to write an object whose checksum does not match', async () => {
    await expect(
      restoreWorkspaceFiles({ manifest: manifest({ checksum: 'deadbeef' }) }),
    ).rejects.toThrow(/Checksum não bate para crm-proposal-images\/ws1\/a.png/)
    expect(mocks.putObject).not.toHaveBeenCalled()
  })

  it('is idempotent: a second run rewrites the same keys and touches nothing else', async () => {
    await restoreWorkspaceFiles({ manifest: manifest() })
    await restoreWorkspaceFiles({ manifest: manifest() })

    const keys = mocks.putObject.mock.calls.map((call) => call[0].key)
    expect(keys).toEqual(['ws1/a.png', 'ws1/a.png'])
    expect(mocks.deleteObjects).not.toHaveBeenCalled()
  })
})

describe('deleteWorkspaceFileArchive()', () => {
  it('deletes every object under the archive prefix', async () => {
    mocks.listObjectKeys.mockResolvedValue(['a.enc', 'b.enc'])
    mocks.deleteObjects.mockResolvedValue(2)

    await expect(deleteWorkspaceFileArchive('ws1', 'bk1')).resolves.toBe(2)
    expect(mocks.listObjectKeys).toHaveBeenCalledWith(
      BACKUP_BUCKET,
      'workspace/ws1/bk1.files/',
    )
    expect(mocks.deleteObjects).toHaveBeenCalledWith(BACKUP_BUCKET, [
      'a.enc',
      'b.enc',
    ])
  })

  it('does nothing for a backup without files', async () => {
    mocks.listObjectKeys.mockResolvedValue([])

    await expect(deleteWorkspaceFileArchive('ws1', 'bk1')).resolves.toBe(0)
    expect(mocks.deleteObjects).not.toHaveBeenCalled()
  })
})

describe('workspaceFilesManifestKey()', () => {
  it('namespaces the manifest by workspace and backup', () => {
    expect(workspaceFilesManifestKey('ws1', 'bk1')).toBe(
      'workspace/ws1/bk1.files/manifest.json.enc',
    )
  })
})
