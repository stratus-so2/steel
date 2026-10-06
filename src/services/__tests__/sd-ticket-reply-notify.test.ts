import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSdSettings } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { DEFAULT_SD_TICKET_PREFIXES } from '@/src/lib/servicedesk/ticket-code'

vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/src/repositories/sd-ticket.repository')
vi.mock('../sd-notification.service', () => ({ notifySdEvent: vi.fn() }))
vi.mock('../sd-ticket-engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-ticket-engine')>()),
  SdTicketEngine: { loadConfig: vi.fn() },
}))

import { logger } from '@/lib/axiom/logger'
import { SdTicketRepository } from '@/src/repositories/sd-ticket.repository'
import { notifySdEvent } from '../sd-notification.service'
import { SdTicketEngine } from '../sd-ticket-engine'
import { notifySdTicketReply, sdReplyPreview } from '../sd-ticket-reply-notify'

const tickets = vi.mocked(SdTicketRepository)
const engine = vi.mocked(SdTicketEngine)
const notify = vi.mocked(notifySdEvent)

const WS = 'ws1'

function ticket() {
  return {
    id: 't1',
    workspaceId: WS,
    number: 7,
    type: 'INCIDENT',
    title: 'Impressora',
    assigneeId: 'agent',
    requesterId: 'req',
    departmentId: 'd1',
    participants: [{ userId: 'guest' }],
    contact: { id: 'c1', name: 'Ana', userId: null },
  } as never
}

beforeEach(() => {
  vi.clearAllMocks()
  engine.loadConfig.mockResolvedValue(
    ok({
      settings: createFakeSdSettings(),
      prefixes: DEFAULT_SD_TICKET_PREFIXES,
    }),
  )
  tickets.findById.mockResolvedValue(ok(ticket()))
  notify.mockResolvedValue(
    ok({
      event: 'ticket.message',
      recipients: 1,
      inApp: 1,
      email: 0,
      whatsapp: 0,
      skipped: null,
    }),
  )
})

describe('sdReplyPreview', () => {
  it('collapses whitespace and truncates long text', () => {
    expect(sdReplyPreview('  oi\n\n tudo  bem ')).toBe('oi tudo bem')
    const long = sdReplyPreview('a'.repeat(300))
    expect(long).toHaveLength(140)
    expect(long.endsWith('…')).toBe(true)
  })

  it('describes an attachment-only or empty message', () => {
    expect(sdReplyPreview('', 2)).toBe('2 anexo(s)')
    expect(sdReplyPreview('   ')).toBe('Nova mensagem')
  })
})

describe('notifySdTicketReply', () => {
  it('notifies only the team: requester and contact are stripped', async () => {
    await notifySdTicketReply({
      workspaceId: WS,
      ticket: ticket(),
      channel: 'EMAIL',
      actorId: 'u9',
      body: 'Ainda não funciona',
    })
    expect(tickets.findById).not.toHaveBeenCalled()
    const [input] = notify.mock.calls[0]
    expect(input).toMatchObject({
      workspaceId: WS,
      event: 'ticket.message',
      actorId: 'u9',
      ticket: {
        id: 't1',
        assigneeId: 'agent',
        participantIds: ['guest'],
        requesterId: null,
        contact: null,
      },
      payload: {
        body: 'Ainda não funciona',
        meta: { channel: 'EMAIL' },
      },
    })
    expect(input.payload.title).toContain('por e-mail')
    expect(input.payload.title).toContain(input.ticket.code)
  })

  it('loads the ticket when only the id is known', async () => {
    await notifySdTicketReply({
      workspaceId: WS,
      ticket: { id: 't1' },
      channel: 'SLACK',
      body: 'resposta',
    })
    expect(tickets.findById).toHaveBeenCalledWith('t1', WS)
    expect(notify.mock.calls[0][0].actorId).toBeNull()
    expect(notify.mock.calls[0][0].payload.title).toContain('Slack')
  })

  it.each([
    ['WHATSAPP', 'WhatsApp'],
    ['GITHUB', 'GitHub'],
  ] as const)('titles a %s reply', async (channel, word) => {
    await notifySdTicketReply({
      workspaceId: WS,
      ticket: ticket(),
      channel,
      body: 'x',
    })
    expect(notify.mock.calls[0][0].payload.title).toContain(word)
  })

  it('only logs when the ticket cannot be loaded', async () => {
    tickets.findById.mockResolvedValue(err(databaseError()))
    await notifySdTicketReply({
      workspaceId: WS,
      ticket: { id: 't1' },
      channel: 'GITHUB',
      body: 'x',
    })
    expect(notify).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      'servicedesk.reply.notify_failed',
      expect.objectContaining({ reason: 'DATABASE_ERROR', channel: 'GITHUB' }),
    )
  })

  it('only logs when the config cannot be loaded', async () => {
    engine.loadConfig.mockResolvedValue(err(databaseError()))
    await notifySdTicketReply({
      workspaceId: WS,
      ticket: ticket(),
      channel: 'EMAIL',
      body: 'x',
    })
    expect(notify).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalled()
  })

  it('only logs when the notification engine fails', async () => {
    notify.mockResolvedValue(err(databaseError()))
    await expect(
      notifySdTicketReply({
        workspaceId: WS,
        ticket: ticket(),
        channel: 'EMAIL',
        body: 'x',
      }),
    ).resolves.toBeUndefined()
    expect(logger.warn).toHaveBeenCalledWith(
      'servicedesk.reply.notify_failed',
      expect.objectContaining({ reason: 'DATABASE_ERROR' }),
    )
  })
})
