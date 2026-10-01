import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSdTicketAttachment } from '@/src/__tests__/factories/sd-ticket-tabs.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { sdTabScope } from '@/src/__tests__/helpers/sd-ticket-tab.helpers'
import { databaseError, sdTicketClosed } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/audit')
vi.mock('@/src/lib/storage/s3', () => ({
  ensureBucket: vi.fn(),
  putObject: vi.fn(),
  getObject: vi.fn(),
  deleteObject: vi.fn(),
}))
vi.mock('@/src/repositories/sd-ticket-attachment.repository')
vi.mock('../sd-ticket-tab-support', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-ticket-tab-support')>()),
  loadSdTicketTab: vi.fn(),
  publishSdTicketTab: vi.fn(),
}))
vi.mock('../sd-ticket-engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-ticket-engine')>()),
  SdTicketEngine: { touchActivity: vi.fn() },
}))
vi.mock('../sd-ticket-event-recorder', () => ({ recordSdTicketEvent: vi.fn() }))

import { auditMutation } from '@/lib/axiom/audit'
import {
  deleteObject,
  ensureBucket,
  getObject,
  putObject,
} from '@/src/lib/storage/s3'
import { SdTicketAttachmentRepository } from '@/src/repositories/sd-ticket-attachment.repository'
import {
  canSeeSdAttachment,
  SdTicketAttachmentService,
} from '../sd-ticket-attachment.service'
import { SdTicketEngine } from '../sd-ticket-engine'
import { recordSdTicketEvent } from '../sd-ticket-event-recorder'
import { loadSdTicketTab, publishSdTicketTab } from '../sd-ticket-tab-support'

const load = vi.mocked(loadSdTicketTab)
const repo = vi.mocked(SdTicketAttachmentRepository)
const publish = vi.mocked(publishSdTicketTab)

const file = (
  over: Partial<{ contentType: string; size: number; fileName: string }> = {},
) => ({
  buffer: Buffer.alloc(over.size ?? 10, 1),
  contentType: over.contentType ?? 'image/png',
  fileName: over.fileName ?? 'C:\\fotos\\Relatório final.png',
})

beforeEach(() => {
  load.mockResolvedValue(ok(sdTabScope()))
  repo.create.mockImplementation(async (data) =>
    ok(createFakeSdTicketAttachment({ ...data, uploadedBy: null })),
  )
  vi.mocked(putObject).mockResolvedValue(undefined)
  vi.mocked(ensureBucket).mockResolvedValue(undefined)
})

describe('canSeeSdAttachment', () => {
  const agent = { userId: 'u1', isAgent: true }
  const requester = { userId: 'req', isAgent: false }
  it('agents see everything; requesters only public or own pending', () => {
    const internal = createFakeSdTicketAttachment({
      messageId: 'm',
      message: { visibility: 'INTERNAL', deletedAt: null },
    })
    expect(canSeeSdAttachment(agent, internal)).toBe(true)
    expect(canSeeSdAttachment(requester, internal)).toBe(false)
    expect(
      canSeeSdAttachment(requester, {
        ...internal,
        message: { visibility: 'PUBLIC', deletedAt: null },
      }),
    ).toBe(true)
    expect(
      canSeeSdAttachment(requester, {
        ...internal,
        message: { visibility: 'PUBLIC', deletedAt: new Date() },
      }),
    ).toBe(false)
    expect(
      canSeeSdAttachment(
        requester,
        createFakeSdTicketAttachment({ uploadedById: 'req' }),
      ),
    ).toBe(true)
    expect(
      canSeeSdAttachment(
        requester,
        createFakeSdTicketAttachment({ uploadedById: 'u1' }),
      ),
    ).toBe(false)
  })
})

describe('upload', () => {
  it('stores the file under the ticket prefix and records it', async () => {
    const dto = expectOk(
      await SdTicketAttachmentService.upload(
        'u1',
        'ws1',
        't1',
        file({ contentType: 'IMAGE/PNG; charset=binary' }),
      ),
    )
    const put = vi.mocked(putObject).mock.calls[0]?.[0]
    expect(put?.bucket).toBe('servicedesk')
    expect(put?.key).toMatch(
      /^ws1\/tickets\/t1\/[a-z0-9]+-Relatorio-final\.png$/,
    )
    expect(put?.contentType).toBe('image/png')
    const created = repo.create.mock.calls[0]?.[0]
    expect(created).toMatchObject({
      workspaceId: 'ws1',
      ticketId: 't1',
      uploadedById: 'u1',
      kind: 'IMAGE',
      fileName: 'Relatório final.png',
      mimeType: 'image/png',
      size: 10,
    })
    expect(dto.url).toBe(
      `/api/workspaces/ws1/servicedesk/tickets/t1/attachments/${created?.id}`,
    )
    expect(SdTicketEngine.touchActivity).toHaveBeenCalledWith('t1')
    expect(recordSdTicketEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'attachment.uploaded' }),
    )
    expect(publish).toHaveBeenCalledWith(
      expect.anything(),
      'ticket.attachment',
      'u1',
      true,
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_ticket_attachment',
        action: 'upload',
      }),
    )
    expect(load).toHaveBeenCalledWith('u1', 'ws1', 't1', 'CREATE', {
      requireOpen: true,
    })
  })

  it('names nameless files and keeps requesters as REQUESTER', async () => {
    load.mockResolvedValue(ok(sdTabScope({ userId: 'req', isAgent: false })))
    expectOk(
      await SdTicketAttachmentService.upload(
        'req',
        'ws1',
        't1',
        file({ fileName: '  ' }),
      ),
    )
    expect(repo.create.mock.calls[0]?.[0].fileName).toBe('arquivo')
    expect(vi.mocked(recordSdTicketEvent).mock.calls[0]?.[0]).toMatchObject({
      actorKind: 'REQUESTER',
    })
  })

  it('rejects disallowed types, empty and oversized files', async () => {
    expectErr(
      await SdTicketAttachmentService.upload(
        'u1',
        'ws1',
        't1',
        file({ contentType: 'text/html' }),
      ),
      'SD_ATTACHMENT_INVALID',
    )
    expectErr(
      await SdTicketAttachmentService.upload(
        'u1',
        'ws1',
        't1',
        file({ size: 0 }),
      ),
      'SD_ATTACHMENT_INVALID',
    )
    expectErr(
      await SdTicketAttachmentService.upload(
        'u1',
        'ws1',
        't1',
        file({ size: 25 * 1024 * 1024 + 1 }),
      ),
      'SD_ATTACHMENT_INVALID',
    )
    expect(putObject).not.toHaveBeenCalled()
  })

  it('maps storage failures and propagates access/db errors', async () => {
    vi.mocked(putObject).mockRejectedValueOnce(new Error('minio down'))
    expectErr(
      await SdTicketAttachmentService.upload('u1', 'ws1', 't1', file()),
      'STORAGE_ERROR',
    )
    vi.mocked(ensureBucket).mockRejectedValueOnce('boom')
    expectErr(
      await SdTicketAttachmentService.upload('u1', 'ws1', 't1', file()),
      'STORAGE_ERROR',
    )
    repo.create.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketAttachmentService.upload('u1', 'ws1', 't1', file()),
      'DATABASE_ERROR',
    )
    load.mockResolvedValueOnce(err(sdTicketClosed()))
    expectErr(
      await SdTicketAttachmentService.upload('u1', 'ws1', 't1', file()),
      'SD_TICKET_CLOSED',
    )
  })
})

describe('list', () => {
  it('lists with the viewer visibility', async () => {
    repo.listForTicket.mockResolvedValue(
      ok([createFakeSdTicketAttachment({ id: 'a1' })]),
    )
    const items = expectOk(
      await SdTicketAttachmentService.list('u1', 'ws1', 't1'),
    )
    expect(items.map((a) => a.id)).toEqual(['a1'])
    expect(repo.listForTicket).toHaveBeenCalledWith({
      ticketId: 't1',
      includeInternal: true,
      viewerId: 'u1',
    })
    load.mockResolvedValue(ok(sdTabScope({ userId: 'req', isAgent: false })))
    expectOk(await SdTicketAttachmentService.list('req', 'ws1', 't1'))
    expect(repo.listForTicket.mock.calls[1]?.[0].includeInternal).toBe(false)
  })

  it('propagates errors', async () => {
    load.mockResolvedValueOnce(err(databaseError()))
    expectErr(await SdTicketAttachmentService.list('u1', 'ws1', 't1'))
    repo.listForTicket.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdTicketAttachmentService.list('u1', 'ws1', 't1'),
      'DATABASE_ERROR',
    )
  })
})

describe('download', () => {
  it('streams a visible attachment', async () => {
    repo.findById.mockResolvedValue(
      ok(
        createFakeSdTicketAttachment({
          fileName: 'a.pdf',
          mimeType: 'application/pdf',
        }),
      ),
    )
    vi.mocked(getObject).mockResolvedValue(Buffer.from('pdf'))
    const out = expectOk(
      await SdTicketAttachmentService.download('u1', 'ws1', 't1', 'a1'),
    )
    expect(out).toEqual({
      body: Buffer.from('pdf'),
      contentType: 'application/pdf',
      fileName: 'a.pdf',
    })
    expect(repo.findById).toHaveBeenCalledWith('a1', 't1')
  })

  it('hides internal attachments from requesters and missing objects', async () => {
    load.mockResolvedValue(ok(sdTabScope({ userId: 'req', isAgent: false })))
    repo.findById.mockResolvedValue(
      ok(
        createFakeSdTicketAttachment({
          messageId: 'm',
          message: { visibility: 'INTERNAL', deletedAt: null },
        }),
      ),
    )
    expectErr(
      await SdTicketAttachmentService.download('req', 'ws1', 't1', 'a1'),
      'SD_ATTACHMENT_NOT_FOUND',
    )
    expect(getObject).not.toHaveBeenCalled()

    load.mockResolvedValue(ok(sdTabScope()))
    vi.mocked(getObject).mockRejectedValue(new Error('NoSuchKey'))
    expectErr(
      await SdTicketAttachmentService.download('u1', 'ws1', 't1', 'a1'),
      'SD_ATTACHMENT_NOT_FOUND',
    )
  })

  it('propagates errors', async () => {
    load.mockResolvedValueOnce(err(databaseError()))
    expectErr(await SdTicketAttachmentService.download('u1', 'ws1', 't1', 'a'))
    repo.findById.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdTicketAttachmentService.download('u1', 'ws1', 't1', 'a'),
      'DATABASE_ERROR',
    )
  })
})

describe('remove', () => {
  beforeEach(() => {
    repo.softDelete.mockResolvedValue(ok(undefined))
    vi.mocked(deleteObject).mockResolvedValue(undefined)
  })

  it('agents remove any attachment (public ones announced publicly)', async () => {
    repo.findById.mockResolvedValue(
      ok(
        createFakeSdTicketAttachment({
          id: 'a1',
          messageId: 'm',
          message: { visibility: 'PUBLIC', deletedAt: null },
        }),
      ),
    )
    expectOk(await SdTicketAttachmentService.remove('u1', 'ws1', 't1', 'a1'))
    expect(repo.softDelete).toHaveBeenCalledWith('a1', expect.any(Date))
    expect(deleteObject).toHaveBeenCalled()
    expect(publish.mock.calls[0]?.[3]).toBe(false)
    expect(recordSdTicketEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'attachment.removed' }),
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delete' }),
    )
    expect(load).toHaveBeenCalledWith('u1', 'ws1', 't1', 'EDIT', {
      requireOpen: true,
    })
  })

  it('internal/pending removals stay internal; storage failure only logs', async () => {
    repo.findById.mockResolvedValue(
      ok(
        createFakeSdTicketAttachment({
          messageId: 'm',
          message: { visibility: 'INTERNAL', deletedAt: null },
        }),
      ),
    )
    vi.mocked(deleteObject).mockRejectedValueOnce(new Error('gone'))
    expectOk(await SdTicketAttachmentService.remove('u1', 'ws1', 't1', 'a1'))
    repo.findById.mockResolvedValue(ok(createFakeSdTicketAttachment()))
    vi.mocked(deleteObject).mockRejectedValueOnce('gone')
    expectOk(await SdTicketAttachmentService.remove('u1', 'ws1', 't1', 'a1'))
    expect(publish.mock.calls.map((c) => c[3])).toEqual([true, true])
  })

  it('requesters only remove their own pending uploads', async () => {
    load.mockResolvedValue(ok(sdTabScope({ userId: 'req', isAgent: false })))
    repo.findById.mockResolvedValue(
      ok(createFakeSdTicketAttachment({ uploadedById: 'req' })),
    )
    expectOk(await SdTicketAttachmentService.remove('req', 'ws1', 't1', 'a1'))

    repo.findById.mockResolvedValue(
      ok(
        createFakeSdTicketAttachment({
          uploadedById: 'req',
          messageId: 'm',
          message: { visibility: 'PUBLIC', deletedAt: null },
        }),
      ),
    )
    expectErr(
      await SdTicketAttachmentService.remove('req', 'ws1', 't1', 'a1'),
      'SD_TICKET_FORBIDDEN',
    )
    repo.findById.mockResolvedValue(
      ok(createFakeSdTicketAttachment({ uploadedById: 'someone' })),
    )
    expectErr(
      await SdTicketAttachmentService.remove('req', 'ws1', 't1', 'a1'),
      'SD_ATTACHMENT_NOT_FOUND',
    )
  })

  it('propagates errors', async () => {
    load.mockResolvedValueOnce(err(sdTicketClosed()))
    expectErr(
      await SdTicketAttachmentService.remove('u1', 'ws1', 't1', 'a1'),
      'SD_TICKET_CLOSED',
    )
    repo.findById.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketAttachmentService.remove('u1', 'ws1', 't1', 'a1'),
      'DATABASE_ERROR',
    )
    repo.findById.mockResolvedValue(ok(createFakeSdTicketAttachment()))
    repo.softDelete.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketAttachmentService.remove('u1', 'ws1', 't1', 'a1'),
      'DATABASE_ERROR',
    )
    expect(deleteObject).not.toHaveBeenCalled()
  })
})
