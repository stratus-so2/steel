import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSdKbArticle } from '@/src/__tests__/factories/sd-kb.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-access.helpers'
import { sdKbArticleNotFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-kb-article.repository')
vi.mock('@/src/lib/storage/s3')

import {
  deleteObjects,
  ensureBucket,
  getObjectWithContentType,
  listObjectKeys,
  putObject,
} from '@/src/lib/storage/s3'
import { SdKbArticleRepository } from '@/src/repositories/sd-kb-article.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import {
  SD_BUCKET,
  SdKbMediaService,
  sdKbMediaPrefix,
  sdKbMediaUrl,
  validateSdKbMedia,
} from '../sd-kb-media.service'

const articles = vi.mocked(SdKbArticleRepository)
const moduleAccess = vi.mocked(WorkspaceModuleAccessRepository)

const WS = 'ws1'
const png = {
  buffer: Buffer.from('png'),
  contentType: 'image/png',
  fileName: 'a.png',
}
const draft = createFakeSdKbArticle({ id: 'a1', workspaceId: WS })
const portal = createFakeSdKbArticle({
  id: 'a1',
  workspaceId: WS,
  status: 'PUBLISHED',
  visibility: 'PORTAL',
})

beforeEach(() => {
  moduleAccess.isEnabled.mockResolvedValue(ok(true))
})

describe('validateSdKbMedia', () => {
  it('accepts known types within the size limit', () => {
    expect(expectOk(validateSdKbMedia('image/png', Buffer.from('x')))).toBe(
      'png',
    )
    expect(
      expectOk(validateSdKbMedia('application/pdf', Buffer.from('x'))),
    ).toBe('pdf')
  })

  it('rejects unknown types, empty and oversized files', () => {
    expectErr(
      validateSdKbMedia('application/x-sh', Buffer.from('x')),
      'SD_ATTACHMENT_INVALID',
    )
    expectErr(
      validateSdKbMedia('image/png', Buffer.alloc(0)),
      'SD_ATTACHMENT_INVALID',
    )
    const cases: [string, number][] = [
      ['image/png', 10],
      ['video/mp4', 200],
      ['audio/mpeg', 50],
      ['application/pdf', 25],
    ]
    for (const [type, mb] of cases) {
      const tooBig = { byteLength: mb * 1024 * 1024 + 1 } as Buffer
      const error = expectErr(
        validateSdKbMedia(type, tooBig),
        'SD_ATTACHMENT_INVALID',
      )
      expect(error.message).toContain(`${mb}MB`)
    }
  })
})

describe('media paths', () => {
  it('builds the prefix and the stable API url', () => {
    expect(sdKbMediaPrefix('w', 'a')).toBe('w/kb/a/')
    expect(sdKbMediaUrl('w', 'a', 'f.png')).toBe(
      '/api/workspaces/w/servicedesk/knowledge/a/media/f.png',
    )
  })
})

describe('SdKbMediaService.upload', () => {
  it('stores the file under the article prefix in the private bucket', async () => {
    actAs('agent')
    articles.findById.mockResolvedValue(ok(draft))
    const result = expectOk(await SdKbMediaService.upload('u1', WS, 'a1', png))
    expect(result.key).toMatch(/^ws1\/kb\/a1\/[a-z0-9]+\.png$/)
    expect(result.url).toMatch(
      /^\/api\/workspaces\/ws1\/servicedesk\/knowledge\/a1\/media\/[a-z0-9]+\.png$/,
    )
    expect(result.name).toBe('a.png')
    expect(ensureBucket).toHaveBeenCalledWith(SD_BUCKET)
    expect(putObject).toHaveBeenCalledWith({
      bucket: SD_BUCKET,
      key: result.key,
      body: png.buffer,
      contentType: 'image/png',
    })
  })

  it('refuses requesters, unknown articles and invalid files', async () => {
    actAs('requester')
    expectErr(
      await SdKbMediaService.upload('u1', WS, 'a1', png),
      'SD_NOT_AGENT',
    )
    actAs('agent')
    articles.findById.mockResolvedValue(err(sdKbArticleNotFound()))
    expectErr(
      await SdKbMediaService.upload('u1', WS, 'x', png),
      'SD_KB_ARTICLE_NOT_FOUND',
    )
    articles.findById.mockResolvedValue(ok(draft))
    expectErr(
      await SdKbMediaService.upload('u1', WS, 'a1', {
        ...png,
        contentType: 'text/html',
      }),
      'SD_ATTACHMENT_INVALID',
    )
    expect(putObject).not.toHaveBeenCalled()
  })

  it('maps storage failures to STORAGE_ERROR', async () => {
    actAs('agent')
    articles.findById.mockResolvedValue(ok(draft))
    vi.mocked(putObject).mockRejectedValueOnce(new Error('minio down'))
    expectErr(
      await SdKbMediaService.upload('u1', WS, 'a1', png),
      'STORAGE_ERROR',
    )
    vi.mocked(ensureBucket).mockRejectedValueOnce('boom')
    expectErr(
      await SdKbMediaService.upload('u1', WS, 'a1', png),
      'STORAGE_ERROR',
    )
  })
})

describe('SdKbMediaService.download', () => {
  const file = 'abcdefghij12.png'

  it('serves the object to agents and to requesters of portal articles', async () => {
    vi.mocked(getObjectWithContentType).mockResolvedValue({
      body: Buffer.from('x'),
      contentType: 'image/png',
    })
    actAs('agent')
    articles.findById.mockResolvedValue(ok(draft))
    expect(
      expectOk(await SdKbMediaService.download('u1', WS, 'a1', file)),
    ).toEqual({ body: Buffer.from('x'), contentType: 'image/png' })
    expect(getObjectWithContentType).toHaveBeenCalledWith({
      bucket: SD_BUCKET,
      key: `ws1/kb/a1/${file}`,
    })

    actAs('requester')
    articles.findById.mockResolvedValue(ok(portal))
    expectOk(await SdKbMediaService.download('u1', WS, 'a1', file))
  })

  it('hides media of drafts from requesters and rejects odd file names', async () => {
    actAs('requester')
    articles.findById.mockResolvedValue(ok(draft))
    expectErr(
      await SdKbMediaService.download('u1', WS, 'a1', file),
      'SD_ATTACHMENT_NOT_FOUND',
    )
    expectErr(
      await SdKbMediaService.download('u1', WS, 'a1', '../other/x.png'),
      'SD_ATTACHMENT_NOT_FOUND',
    )
  })

  it('propagates access, article and storage failures', async () => {
    actAs('non-member')
    expectErr(
      await SdKbMediaService.download('u1', WS, 'a1', file),
      'FORBIDDEN',
    )
    actAs('agent')
    articles.findById.mockResolvedValue(err(sdKbArticleNotFound()))
    expectErr(
      await SdKbMediaService.download('u1', WS, 'a1', file),
      'SD_KB_ARTICLE_NOT_FOUND',
    )
    articles.findById.mockResolvedValue(ok(draft))
    vi.mocked(getObjectWithContentType).mockRejectedValueOnce(new Error('404'))
    expectErr(
      await SdKbMediaService.download('u1', WS, 'a1', file),
      'SD_ATTACHMENT_NOT_FOUND',
    )
  })
})

describe('SdKbMediaService.purgeArticles', () => {
  it('deletes each article prefix, skipping empty ones and logging failures', async () => {
    vi.mocked(listObjectKeys)
      .mockResolvedValueOnce(['ws1/kb/a1/x.png'])
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce('down')
    await SdKbMediaService.purgeArticles(WS, ['a1', 'a2', 'a3', 'a4'])
    expect(listObjectKeys).toHaveBeenCalledWith(SD_BUCKET, 'ws1/kb/a2/')
    expect(deleteObjects).toHaveBeenCalledTimes(1)
    expect(deleteObjects).toHaveBeenCalledWith(SD_BUCKET, ['ws1/kb/a1/x.png'])
  })
})
