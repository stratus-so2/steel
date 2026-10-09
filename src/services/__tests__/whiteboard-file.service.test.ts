import type { Role } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeWhiteboard } from '@/src/__tests__/factories/whiteboard.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import {
  ensureBucket,
  getObjectWithContentType,
  putObject,
} from '@/src/lib/storage/s3'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import {
  WhiteboardRepository,
  WhiteboardSettingsRepository,
} from '@/src/repositories/whiteboard.repository'
import {
  WHITEBOARD_BUCKET,
  WhiteboardFileService,
} from '../whiteboard-file.service'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/whiteboard.repository')
vi.mock('@/src/lib/storage/s3', () => ({
  ensureBucket: vi.fn(async () => undefined),
  putObject: vi.fn(async () => undefined),
  getObjectWithContentType: vi.fn(),
}))
vi.mock('@/lib/axiom/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const memberships = vi.mocked(MembershipRepository)
const boards = vi.mocked(WhiteboardRepository)
const settings = vi.mocked(WhiteboardSettingsRepository)
const put = vi.mocked(putObject)
const get = vi.mocked(getObjectWithContentType)

const WS = 'ws1'
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47])

function as(role: Role) {
  memberships.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ userId: 'a', workspaceId: WS, role })),
  )
}

function named(name: string) {
  const error = new Error(name)
  error.name = name
  return error
}

beforeEach(() => {
  vi.clearAllMocks()
  as('MEMBER')
  settings.isEnabled.mockResolvedValue(ok(true))
  boards.findById.mockResolvedValue(
    ok(createFakeWhiteboard({ id: 'b1', workspaceId: WS })),
  )
})

describe('uploadImage()', () => {
  it('stores the image under the workspace by file id', async () => {
    const result = expectOk(
      await WhiteboardFileService.uploadImage('a', WS, {
        fileId: 'abc123',
        buffer: PNG,
        contentType: 'image/png',
      }),
    )

    expect(result).toEqual({ fileId: 'abc123' })
    expect(ensureBucket).toHaveBeenCalledWith(WHITEBOARD_BUCKET)
    expect(put).toHaveBeenCalledWith({
      bucket: WHITEBOARD_BUCKET,
      key: `${WS}/files/abc123`,
      body: PNG,
      contentType: 'image/png',
    })
  })

  it('validates id, type and size', async () => {
    const upload = (
      fileId: string,
      contentType: string,
      buffer: Buffer = PNG,
    ) =>
      WhiteboardFileService.uploadImage('a', WS, {
        fileId,
        buffer,
        contentType,
      })

    expectErr(await upload('../x', 'image/png'), 'VALIDATION_ERROR')
    expectErr(await upload('f1', 'application/pdf'), 'VALIDATION_ERROR')
    expectErr(
      await upload('f1', 'image/png', Buffer.alloc(0)),
      'VALIDATION_ERROR',
    )
    expectErr(
      await upload('f1', 'image/jpeg', Buffer.alloc(10 * 1024 * 1024 + 1)),
      'VALIDATION_ERROR',
    )
    expect(put).not.toHaveBeenCalled()
  })

  it('maps a storage failure and denies VIEWERs', async () => {
    put.mockRejectedValueOnce(new Error('down'))
    expectErr(
      await WhiteboardFileService.uploadImage('a', WS, {
        fileId: 'f1',
        buffer: PNG,
        contentType: 'image/png',
      }),
      'STORAGE_ERROR',
    )
    put.mockRejectedValueOnce('down')
    expectErr(
      await WhiteboardFileService.uploadImage('a', WS, {
        fileId: 'f1',
        buffer: PNG,
        contentType: 'image/png',
      }),
      'STORAGE_ERROR',
    )
    as('VIEWER')
    expectErr(
      await WhiteboardFileService.uploadImage('a', WS, {
        fileId: 'f1',
        buffer: PNG,
        contentType: 'image/png',
      }),
      'WHITEBOARD_FORBIDDEN',
    )
  })
})

describe('getImage()', () => {
  it('reads the image for any member', async () => {
    as('VIEWER')
    get.mockResolvedValue({ body: PNG, contentType: 'image/png' })

    expect(
      expectOk(await WhiteboardFileService.getImage('a', WS, 'f1')),
    ).toEqual({ body: PNG, contentType: 'image/png' })
    expect(get).toHaveBeenCalledWith({
      bucket: WHITEBOARD_BUCKET,
      key: `${WS}/files/f1`,
    })
  })

  it('answers not found for a bad id or a missing object, storage error otherwise', async () => {
    expectErr(
      await WhiteboardFileService.getImage('a', WS, '../x'),
      'WHITEBOARD_FILE_NOT_FOUND',
    )
    for (const name of ['NoSuchKey', 'NoSuchBucket', 'NotFound']) {
      get.mockRejectedValueOnce(named(name))
      expectErr(
        await WhiteboardFileService.getImage('a', WS, 'f1'),
        'WHITEBOARD_FILE_NOT_FOUND',
      )
    }
    get.mockRejectedValueOnce(new Error('down'))
    expectErr(
      await WhiteboardFileService.getImage('a', WS, 'f1'),
      'STORAGE_ERROR',
    )
    get.mockRejectedValueOnce('down')
    expectErr(
      await WhiteboardFileService.getImage('a', WS, 'f1'),
      'STORAGE_ERROR',
    )
    settings.isEnabled.mockResolvedValueOnce(ok(false))
    expectErr(
      await WhiteboardFileService.getImage('a', WS, 'f1'),
      'WHITEBOARD_DISABLED',
    )
  })
})

describe('thumbnails', () => {
  it('stores a PNG preview and stamps the board', async () => {
    const at = new Date('2026-10-09T12:00:00.000Z')
    boards.setThumbnailAt.mockResolvedValue(ok(at))

    expect(
      expectOk(
        await WhiteboardFileService.uploadThumbnail('a', WS, 'b1', {
          buffer: PNG,
          contentType: 'image/png',
        }),
      ),
    ).toEqual({ thumbnailAt: at.toISOString() })
    expect(put).toHaveBeenCalledWith(
      expect.objectContaining({ key: `${WS}/thumbnails/b1.png` }),
    )
  })

  it('validates the preview and propagates errors', async () => {
    const upload = (buffer: Buffer, contentType = 'image/png') =>
      WhiteboardFileService.uploadThumbnail('a', WS, 'b1', {
        buffer,
        contentType,
      })

    expectErr(await upload(PNG, 'image/jpeg'), 'VALIDATION_ERROR')
    expectErr(await upload(Buffer.alloc(0)), 'VALIDATION_ERROR')
    expectErr(await upload(Buffer.alloc(512 * 1024 + 1)), 'VALIDATION_ERROR')

    put.mockRejectedValueOnce(new Error('down'))
    expectErr(await upload(PNG), 'STORAGE_ERROR')

    boards.setThumbnailAt.mockResolvedValueOnce(err(databaseError()))
    expectErr(await upload(PNG), 'DATABASE_ERROR')

    boards.findById.mockResolvedValueOnce(
      ok(createFakeWhiteboard({ workspaceId: 'other' })),
    )
    expectErr(await upload(PNG), 'WHITEBOARD_FORBIDDEN')

    as('VIEWER')
    expectErr(await upload(PNG), 'WHITEBOARD_FORBIDDEN')
  })

  it('serves the preview only when the board has one', async () => {
    expectErr(
      await WhiteboardFileService.getThumbnail('a', WS, 'b1'),
      'WHITEBOARD_FILE_NOT_FOUND',
    )

    boards.findById.mockResolvedValue(
      ok(
        createFakeWhiteboard({
          id: 'b1',
          workspaceId: WS,
          thumbnailAt: new Date(),
        }),
      ),
    )
    get.mockResolvedValue({ body: PNG, contentType: 'image/png' })
    expectOk(await WhiteboardFileService.getThumbnail('a', WS, 'b1'))
    expect(get).toHaveBeenCalledWith({
      bucket: WHITEBOARD_BUCKET,
      key: `${WS}/thumbnails/b1.png`,
    })

    boards.findById.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await WhiteboardFileService.getThumbnail('a', WS, 'b1'),
      'DATABASE_ERROR',
    )
    memberships.findByUserAndWorkspace.mockResolvedValue(ok(null))
    expectErr(
      await WhiteboardFileService.getThumbnail('a', WS, 'b1'),
      'FORBIDDEN',
    )
  })
})
