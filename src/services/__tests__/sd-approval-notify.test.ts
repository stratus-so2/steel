import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
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
import {
  notifySdApprovalCanceled,
  notifySdApprovalsExpired,
} from '../sd-approval-notify'
import { notifySdEvent } from '../sd-notification.service'
import { SdTicketEngine } from '../sd-ticket-engine'

const tickets = vi.mocked(SdTicketRepository)
const engine = vi.mocked(SdTicketEngine)
const notify = vi.mocked(notifySdEvent)

const outcome = ok({
  event: 'x',
  recipients: 1,
  inApp: 1,
  email: 0,
  whatsapp: 0,
  skipped: null,
} as const)

beforeEach(() => {
  vi.clearAllMocks()
  tickets.findById.mockImplementation(async (id) =>
    ok(createFakeSdTicket({ id, number: 7, workspaceId: 'ws1' })),
  )
  engine.loadConfig.mockResolvedValue(
    ok({
      settings: createFakeSdSettings(),
      prefixes: DEFAULT_SD_TICKET_PREFIXES,
    }),
  )
  notify.mockResolvedValue(outcome)
})

const item = (overrides = {}) => ({
  workspaceId: 'ws1',
  ticketId: 't1',
  requestedById: 'u1',
  label: 'Diretora',
  ...overrides,
})

describe('notifySdApprovalsExpired', () => {
  it('sends one notice per ticket to the assignee and the requesters', async () => {
    await notifySdApprovalsExpired([
      item(),
      item({ requestedById: 'u2', label: 'Diretora' }),
      item({ ticketId: 't2', label: 'comitê CAB' }),
    ])
    expect(notify).toHaveBeenCalledTimes(2)
    const [first] = notify.mock.calls[0]
    expect(first).toMatchObject({
      workspaceId: 'ws1',
      event: 'approval.expired',
      ticket: { id: 't1' },
      payload: {
        userIds: ['u1', 'u2'],
        body: 'Sem resposta de Diretora dentro do prazo.',
        meta: { expired: 2 },
      },
    })
    expect(first.actorId).toBeUndefined()
    expect(first.payload.title).toContain(first.ticket.code)
    expect(notify.mock.calls[1][0].ticket.id).toBe('t2')
  })

  it('skips a ticket it cannot load and keeps going', async () => {
    tickets.findById.mockResolvedValueOnce(err(databaseError()))
    await notifySdApprovalsExpired([item(), item({ ticketId: 't2' })])
    expect(notify).toHaveBeenCalledTimes(1)
    expect(logger.warn).toHaveBeenCalledWith(
      'servicedesk.approval.expired_notify_failed',
      expect.objectContaining({ ticketId: 't1', reason: 'DATABASE_ERROR' }),
    )
  })

  it('skips when the config cannot be loaded', async () => {
    engine.loadConfig.mockResolvedValue(err(databaseError()))
    await notifySdApprovalsExpired([item()])
    expect(notify).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalled()
  })

  it('only logs a failed delivery', async () => {
    notify.mockResolvedValue(err(databaseError()))
    await expect(notifySdApprovalsExpired([item()])).resolves.toBeUndefined()
    expect(logger.warn).toHaveBeenCalledWith(
      'servicedesk.approval.expired_notify_failed',
      expect.objectContaining({ reason: 'DATABASE_ERROR' }),
    )
  })

  it('does nothing for an empty list', async () => {
    await notifySdApprovalsExpired([])
    expect(tickets.findById).not.toHaveBeenCalled()
  })
})

describe('notifySdApprovalCanceled', () => {
  const ticket = createFakeSdTicket({ id: 't1', workspaceId: 'ws1' })

  it('notifies only the platform approvers, never the actor', async () => {
    await notifySdApprovalCanceled({
      ticket,
      code: 'INC-000007',
      actorId: 'u1',
      approverUserIds: ['boss', null],
      body: 'Compra',
    })
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'approval.canceled',
        actorId: 'u1',
        audience: 'payload',
        payload: {
          title: 'Aprovação cancelada em INC-000007',
          body: 'Compra',
          userIds: ['boss'],
        },
      }),
    )
  })

  it('skips approvers without an account', async () => {
    await notifySdApprovalCanceled({
      ticket,
      code: 'INC-000007',
      actorId: 'u1',
      approverUserIds: [null],
      body: 'x',
    })
    expect(notify).not.toHaveBeenCalled()
  })

  it('only logs a failed delivery', async () => {
    notify.mockResolvedValue(err(databaseError()))
    await notifySdApprovalCanceled({
      ticket,
      code: 'INC-000007',
      actorId: 'u1',
      approverUserIds: ['boss'],
      body: 'x',
    })
    expect(logger.warn).toHaveBeenCalledWith(
      'servicedesk.approval.canceled_notify_failed',
      expect.objectContaining({ ticketId: 't1' }),
    )
  })
})
