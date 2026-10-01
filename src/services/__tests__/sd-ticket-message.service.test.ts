import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSdUserSummary } from '@/src/__tests__/factories/sd-ticket.factory'
import {
  createFakeSdTicketAttachment,
  createFakeSdTicketMessage,
} from '@/src/__tests__/factories/sd-ticket-tabs.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { sdTabScope } from '@/src/__tests__/helpers/sd-ticket-tab.helpers'
import { databaseError, sdTicketForbidden } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { ListSdTicketMessagesSchema } from '@/src/schemas/sd-ticket-message.schema'

vi.mock('@/lib/axiom/audit')
vi.mock('@/src/repositories/sd-ticket-message.repository')
vi.mock('@/src/repositories/sd-ticket-attachment.repository')
vi.mock('../sd-ticket-tab-support', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-ticket-tab-support')>()),
  loadSdTicketTab: vi.fn(),
  publishSdTicketTab: vi.fn(),
}))
vi.mock('../sd-ticket-engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-ticket-engine')>()),
  SdTicketEngine: {
    markFirstResponse: vi.fn(),
    touchActivity: vi.fn(),
    reopen: vi.fn(),
  },
}))
vi.mock('../sd-ticket-event-recorder', () => ({ recordSdTicketEvent: vi.fn() }))
vi.mock('../sd-ticket-notifier', () => ({
  SdTicketNotifier: { notify: vi.fn() },
}))
vi.mock('../sd-automation-engine', () => ({
  fireSdAutomations: vi.fn(async () => undefined),
}))

import { auditMutation } from '@/lib/axiom/audit'
import { SdTicketAttachmentRepository } from '@/src/repositories/sd-ticket-attachment.repository'
import { SdTicketMessageRepository } from '@/src/repositories/sd-ticket-message.repository'
import { fireSdAutomations } from '../sd-automation-engine'
import { SdTicketEngine } from '../sd-ticket-engine'
import { recordSdTicketEvent } from '../sd-ticket-event-recorder'
import { SdTicketMessageService } from '../sd-ticket-message.service'
import { SdTicketNotifier } from '../sd-ticket-notifier'
import { loadSdTicketTab, publishSdTicketTab } from '../sd-ticket-tab-support'

const load = vi.mocked(loadSdTicketTab)
const repo = vi.mocked(SdTicketMessageRepository)
const attachments = vi.mocked(SdTicketAttachmentRepository)
const engine = vi.mocked(SdTicketEngine)
const notify = vi.mocked(SdTicketNotifier.notify)
const publish = vi.mocked(publishSdTicketTab)

const guest = createFakeSdUserSummary({ id: 'guest' })
const participants = [{ userId: 'guest', user: guest }]
const recent = () => new Date(Date.now() - 60_000)

beforeEach(() => {
  load.mockResolvedValue(
    ok(sdTabScope({ ticket: { assigneeId: 'u1', participants } })),
  )
  attachments.findUnattached.mockResolvedValue(ok([]))
  repo.create.mockImplementation(async (data) =>
    ok(
      createFakeSdTicketMessage({
        visibility: data.visibility,
        body: data.body,
        authorUserId: data.authorUserId,
        authorKind: data.authorKind,
        createdAt: new Date(),
      }),
    ),
  )
  repo.filterAgentIds.mockResolvedValue(ok(['guest']))
  engine.reopen.mockResolvedValue(ok({} as never))
})

describe('list', () => {
  it('returns the page oldest-first with the next cursor', async () => {
    const newest = createFakeSdTicketMessage({ id: 'm2' })
    const oldest = createFakeSdTicketMessage({ id: 'm1' })
    repo.list.mockResolvedValue(ok({ items: [newest, oldest], hasMore: true }))
    const page = expectOk(
      await SdTicketMessageService.list(
        'u1',
        'ws1',
        't1',
        ListSdTicketMessagesSchema.parse({ before: 'm9', limit: '2' }),
      ),
    )
    expect(page.items.map((m) => m.id)).toEqual(['m1', 'm2'])
    expect(page.nextBefore).toBe('m1')
    expect(repo.list).toHaveBeenCalledWith({
      ticketId: 't1',
      includeInternal: true,
      before: 'm9',
      limit: 2,
    })
    expect(load).toHaveBeenCalledWith('u1', 'ws1', 't1', 'VIEW')
  })

  it('hides internal notes from requesters and ends pagination', async () => {
    load.mockResolvedValue(ok(sdTabScope({ userId: 'req', isAgent: false })))
    repo.list.mockResolvedValue(ok({ items: [], hasMore: false }))
    const page = expectOk(
      await SdTicketMessageService.list('req', 'ws1', 't1', { limit: 50 }),
    )
    expect(page).toEqual({ items: [], nextBefore: null })
    expect(repo.list.mock.calls[0]?.[0].includeInternal).toBe(false)
  })

  it('propagates access and repository errors', async () => {
    load.mockResolvedValueOnce(err(sdTicketForbidden()))
    expectErr(
      await SdTicketMessageService.list('x', 'ws1', 't1', { limit: 50 }),
      'SD_TICKET_FORBIDDEN',
    )
    repo.list.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdTicketMessageService.list('u1', 'ws1', 't1', { limit: 50 }),
      'DATABASE_ERROR',
    )
  })
})

describe('create', () => {
  const input = {
    body: 'Reiniciei o servidor',
    visibility: 'PUBLIC' as const,
    attachmentIds: [],
  }

  it('posts a public agent reply: first response, event, notify, realtime, automation', async () => {
    const dto = expectOk(
      await SdTicketMessageService.create('u1', 'ws1', 't1', input),
    )
    expect(dto.body).toBe('Reiniciei o servidor')
    expect(dto.canEdit).toBe(true)
    expect(load).toHaveBeenCalledWith('u1', 'ws1', 't1', 'CREATE', {
      requireOpen: true,
    })
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ authorKind: 'AGENT', authorUserId: 'u1' }),
    )
    expect(engine.markFirstResponse).toHaveBeenCalledWith(
      't1',
      expect.any(Date),
    )
    expect(engine.touchActivity).toHaveBeenCalled()
    expect(recordSdTicketEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'message.posted', actorKind: 'AGENT' }),
    )
    const notice = notify.mock.calls[0]?.[0]
    expect(notice?.userIds).toEqual(['u1', 'guest', 'req'])
    expect(notice?.excludeUserIds).toEqual(['u1'])
    expect(notice?.kind).toBe('SD_TICKET_MESSAGE')
    expect(notice?.title).toBe('Nova mensagem em INC-000007')
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't1' }),
      'ticket.message',
      'u1',
      false,
    )
    expect(fireSdAutomations).toHaveBeenCalledWith('MESSAGE_RECEIVED', 't1', {
      actorId: 'u1',
    })
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_ticket_message',
        action: 'create',
      }),
    )
    expect(engine.reopen).not.toHaveBeenCalled()
  })

  it('internal notes: no first response, agents only, no automation', async () => {
    load.mockResolvedValue(
      ok(
        sdTabScope({
          ticket: {
            assigneeId: 'a2',
            participants,
            contact: {
              id: 'c',
              name: 'C',
              email: null,
              phone: null,
              userId: 'cu',
            },
          },
        }),
      ),
    )
    expectOk(
      await SdTicketMessageService.create('u1', 'ws1', 't1', {
        ...input,
        visibility: 'INTERNAL',
      }),
    )
    expect(engine.markFirstResponse).not.toHaveBeenCalled()
    expect(repo.filterAgentIds).toHaveBeenCalledWith('ws1', ['a2', 'guest'])
    expect(notify.mock.calls[0]?.[0].userIds).toEqual(['guest'])
    expect(notify.mock.calls[0]?.[0].title).toBe(
      'Nova nota interna em INC-000007',
    )
    expect(publish.mock.calls[0]?.[3]).toBe(true)
    expect(fireSdAutomations).not.toHaveBeenCalled()
  })

  it('notifies nobody on an internal note when the agent lookup fails', async () => {
    repo.filterAgentIds.mockResolvedValue(err(databaseError()))
    expectOk(
      await SdTicketMessageService.create('u1', 'ws1', 't1', {
        ...input,
        visibility: 'INTERNAL',
      }),
    )
    expect(notify.mock.calls[0]?.[0].userIds).toEqual([])
  })

  it('requesters cannot write internal notes', async () => {
    load.mockResolvedValue(ok(sdTabScope({ userId: 'req', isAgent: false })))
    expectErr(
      await SdTicketMessageService.create('req', 'ws1', 't1', {
        ...input,
        visibility: 'INTERNAL',
      }),
      'SD_TICKET_FORBIDDEN',
    )
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('a requester reply reopens a RESOLVED ticket when configured', async () => {
    const resolved = sdTabScope({
      userId: 'req',
      isAgent: false,
      ticket: {
        phase: {
          ...sdTabScope().ticket.phase,
          category: 'RESOLVED',
        },
      },
    })
    load.mockResolvedValue(ok(resolved))
    expectOk(await SdTicketMessageService.create('req', 'ws1', 't1', input))
    expect(repo.create.mock.calls[0]?.[0].authorKind).toBe('REQUESTER')
    expect(engine.markFirstResponse).not.toHaveBeenCalled()
    expect(engine.reopen).toHaveBeenCalledWith(
      resolved.ticket,
      resolved.actor,
      resolved.config,
    )

    engine.reopen.mockResolvedValue(err(databaseError()))
    expectOk(await SdTicketMessageService.create('req', 'ws1', 't1', input))

    engine.reopen.mockClear()
    load.mockResolvedValue(
      ok(
        sdTabScope({
          userId: 'req',
          isAgent: false,
          settings: { reopenOnRequesterReply: false },
          ticket: { phase: resolved.ticket.phase },
        }),
      ),
    )
    expectOk(await SdTicketMessageService.create('req', 'ws1', 't1', input))
    load.mockResolvedValue(ok(sdTabScope({ userId: 'req', isAgent: false })))
    expectOk(await SdTicketMessageService.create('req', 'ws1', 't1', input))
    expect(engine.reopen).not.toHaveBeenCalled()
  })

  it('attaches only the actor’s own pending uploads', async () => {
    attachments.findUnattached.mockResolvedValue(
      ok([{ id: 'a1', uploadedById: 'u1', kind: 'IMAGE' }]),
    )
    repo.create.mockResolvedValue(
      ok(
        createFakeSdTicketMessage({
          body: '',
          attachments: [createFakeSdTicketAttachment({ id: 'a1' })],
        }),
      ),
    )
    const dto = expectOk(
      await SdTicketMessageService.create('u1', 'ws1', 't1', {
        body: '',
        visibility: 'PUBLIC',
        attachmentIds: ['a1', 'a1'],
      }),
    )
    expect(dto.attachments).toHaveLength(1)
    expect(attachments.findUnattached).toHaveBeenCalledWith(['a1'], 't1')
    expect(notify.mock.calls[0]?.[0].body).toBe('1 anexo(s)')

    attachments.findUnattached.mockResolvedValue(
      ok([{ id: 'a1', uploadedById: 'someone', kind: 'IMAGE' }]),
    )
    expectErr(
      await SdTicketMessageService.create('u1', 'ws1', 't1', {
        ...input,
        attachmentIds: ['a1'],
      }),
      'SD_ATTACHMENT_NOT_FOUND',
    )
    attachments.findUnattached.mockResolvedValue(ok([]))
    expectErr(
      await SdTicketMessageService.create('u1', 'ws1', 't1', {
        ...input,
        attachmentIds: ['a2'],
      }),
      'SD_ATTACHMENT_NOT_FOUND',
    )
  })

  it('truncates long previews in the notification', async () => {
    const long = 'x'.repeat(300)
    expectOk(
      await SdTicketMessageService.create('u1', 'ws1', 't1', {
        ...input,
        body: long,
      }),
    )
    const body = notify.mock.calls[0]?.[0].body ?? ''
    expect(body).toHaveLength(140)
    expect(body.endsWith('…')).toBe(true)
  })

  it('propagates access and repository errors', async () => {
    load.mockResolvedValueOnce(err(sdTicketForbidden()))
    expectErr(
      await SdTicketMessageService.create('u1', 'ws1', 't1', input),
      'SD_TICKET_FORBIDDEN',
    )
    attachments.findUnattached.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketMessageService.create('u1', 'ws1', 't1', input),
      'DATABASE_ERROR',
    )
    repo.create.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketMessageService.create('u1', 'ws1', 't1', input),
      'DATABASE_ERROR',
    )
  })
})

describe('update / remove (author, 15 min)', () => {
  const own = () =>
    createFakeSdTicketMessage({
      id: 'm1',
      authorUserId: 'u1',
      createdAt: recent(),
    })

  beforeEach(() => {
    repo.findById.mockResolvedValue(ok(own()))
    repo.updateBody.mockImplementation(async (_id, body) =>
      ok({ ...own(), body, editedAt: new Date() }),
    )
    repo.softDelete.mockResolvedValue(ok(undefined))
  })

  it('edits the own recent message', async () => {
    const dto = expectOk(
      await SdTicketMessageService.update('u1', 'ws1', 't1', 'm1', {
        body: 'corrigido',
      }),
    )
    expect(dto.body).toBe('corrigido')
    expect(dto.editedAt).not.toBeNull()
    expect(repo.findById).toHaveBeenCalledWith('m1', 't1')
    expect(recordSdTicketEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'message.edited' }),
    )
    expect(publish.mock.calls[0]?.[3]).toBe(false)
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'update' }),
    )
  })

  it('deletes the own recent message (internal note stays internal)', async () => {
    repo.findById.mockResolvedValue(ok({ ...own(), visibility: 'INTERNAL' }))
    expectOk(await SdTicketMessageService.remove('u1', 'ws1', 't1', 'm1'))
    expect(repo.softDelete).toHaveBeenCalledWith('m1', expect.any(Date))
    expect(recordSdTicketEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'message.deleted' }),
    )
    expect(publish.mock.calls[0]?.[3]).toBe(true)
  })

  it('refuses other authors, expired windows and system messages', async () => {
    repo.findById.mockResolvedValue(
      ok({ ...own(), authorUserId: 'someone-else' }),
    )
    expectErr(
      await SdTicketMessageService.update('u1', 'ws1', 't1', 'm1', {
        body: 'x',
      }),
      'SD_MESSAGE_FORBIDDEN',
    )
    repo.findById.mockResolvedValue(
      ok({ ...own(), createdAt: new Date(Date.now() - 16 * 60_000) }),
    )
    expectErr(
      await SdTicketMessageService.remove('u1', 'ws1', 't1', 'm1'),
      'SD_MESSAGE_FORBIDDEN',
    )
    repo.findById.mockResolvedValue(
      ok({ ...own(), authorUserId: null, authorKind: 'SYSTEM' }),
    )
    expectErr(
      await SdTicketMessageService.remove('u1', 'ws1', 't1', 'm1'),
      'SD_MESSAGE_FORBIDDEN',
    )
    expect(repo.updateBody).not.toHaveBeenCalled()
    expect(repo.softDelete).not.toHaveBeenCalled()
  })

  it('hides internal notes from requesters (not found)', async () => {
    load.mockResolvedValue(ok(sdTabScope({ userId: 'u1', isAgent: false })))
    repo.findById.mockResolvedValue(ok({ ...own(), visibility: 'INTERNAL' }))
    expectErr(
      await SdTicketMessageService.update('u1', 'ws1', 't1', 'm1', {
        body: 'x',
      }),
      'SD_MESSAGE_NOT_FOUND',
    )
  })

  it('propagates access, lookup and write errors', async () => {
    load.mockResolvedValueOnce(err(sdTicketForbidden()))
    expectErr(
      await SdTicketMessageService.update('u1', 'ws1', 't1', 'm1', {
        body: 'x',
      }),
      'SD_TICKET_FORBIDDEN',
    )
    load.mockResolvedValueOnce(err(sdTicketForbidden()))
    expectErr(
      await SdTicketMessageService.remove('u1', 'ws1', 't1', 'm1'),
      'SD_TICKET_FORBIDDEN',
    )
    repo.findById.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketMessageService.update('u1', 'ws1', 't1', 'm1', {
        body: 'x',
      }),
      'DATABASE_ERROR',
    )
    repo.findById.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketMessageService.remove('u1', 'ws1', 't1', 'm1'),
      'DATABASE_ERROR',
    )
    repo.updateBody.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketMessageService.update('u1', 'ws1', 't1', 'm1', {
        body: 'x',
      }),
      'DATABASE_ERROR',
    )
    repo.softDelete.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketMessageService.remove('u1', 'ws1', 't1', 'm1'),
      'DATABASE_ERROR',
    )
  })
})
