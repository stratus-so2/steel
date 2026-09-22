import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import {
  createFakeSdTicket,
  createFakeSdTicketEvent,
} from '@/src/__tests__/factories/sd-ticket.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/lib/env/env', () => ({ NEXT_PUBLIC_URL: 'https://steel.test' }))
vi.mock('@/src/lib/mail/servicedesk/send-sd-ticket-notification', () => ({
  sendSdTicketNotificationEmail: vi.fn(),
}))
vi.mock('@/src/repositories/sd-ticket-event.repository')
vi.mock('@/src/repositories/sd-ticket-context.repository')
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/services/notification.service')
vi.mock('@/src/services/sd-ticket-engine', () => ({
  SdTicketEngine: { resolveRef: vi.fn() },
}))

import { logger } from '@/lib/axiom/logger'
import { sendSdTicketNotificationEmail } from '@/src/lib/mail/servicedesk/send-sd-ticket-notification'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { SdAccessRepository } from '@/src/repositories/sd-access.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { SdTicketEventRepository } from '@/src/repositories/sd-ticket-event.repository'
import { NotificationService } from '../notification.service'
import { SdTicketEngine } from '../sd-ticket-engine'
import {
  recordSdTicketEvent as recordReexport,
  SdTicketEventService,
} from '../sd-ticket-event.service'
import {
  recordSdTicketEvent,
  sdEventActorKind,
} from '../sd-ticket-event-recorder'
import { SdTicketNotifier, sdTicketHref } from '../sd-ticket-notifier'
import { canViewSdTicket } from '../sd-ticket-visibility'

const eventRepo = vi.mocked(SdTicketEventRepository)
const ctxRepo = vi.mocked(SdTicketContextRepository)
const notifications = vi.mocked(NotificationService)
const sendEmail = vi.mocked(sendSdTicketNotificationEmail)

const input = {
  workspaceId: 'ws1',
  ticketId: 't1',
  actorKind: 'AGENT' as const,
  action: 'ticket.created',
}

describe('recordSdTicketEvent', () => {
  it('records one or many events', async () => {
    eventRepo.createMany.mockResolvedValue(ok(2))
    expect(expectOk(await recordSdTicketEvent([input, input]))).toBe(2)
    eventRepo.createMany.mockResolvedValue(ok(1))
    expect(expectOk(await recordSdTicketEvent(input))).toBe(1)
    expect(eventRepo.createMany).toHaveBeenLastCalledWith([input])
    expect(recordReexport).toBe(recordSdTicketEvent)
  })

  it('never fails the caller on db errors', async () => {
    eventRepo.createMany.mockResolvedValue(err(databaseError()))
    expect(expectOk(await recordSdTicketEvent(input))).toBe(0)
    expect(logger.error).toHaveBeenCalledWith(
      'servicedesk.ticket_event.record_failed',
      expect.objectContaining({ actions: 'ticket.created' }),
    )
  })

  it('derives the actor kind', () => {
    expect(sdEventActorKind({ kind: 'system' })).toBe('SYSTEM')
    expect(sdEventActorKind({ kind: 'user', isAgent: true })).toBe('AGENT')
    expect(sdEventActorKind({ kind: 'user', isAgent: false })).toBe('REQUESTER')
  })
})

describe('canViewSdTicket', () => {
  const t = createFakeSdTicket({
    requesterId: 'r',
    participants: [
      {
        userId: 'p',
        user: { id: 'p', name: 'P', email: 'p@x', image: null },
      },
    ],
    contact: { id: 'c', name: 'C', email: null, phone: null, userId: 'cu' },
  })
  it.each([
    [{ userId: 'x', isAgent: true }, true],
    [{ userId: 'r', isAgent: false }, true],
    [{ userId: 'p', isAgent: false }, true],
    [{ userId: 'cu', isAgent: false }, true],
    [{ userId: 'x', isAgent: false }, false],
  ])('%j → %s', (viewer, expected) => {
    expect(canViewSdTicket(viewer, t)).toBe(expected)
  })
  it('handles tickets without contact', () => {
    expect(
      canViewSdTicket({ userId: 'x', isAgent: false }, createFakeSdTicket()),
    ).toBe(false)
  })
})

describe('SdTicketNotifier', () => {
  const base = {
    workspaceId: 'ws1',
    kind: 'SD_TICKET_ASSIGNED' as const,
    ticket: { number: 7, code: 'INC-000007', title: 'T' },
    title: 'Atribuído',
    body: 'corpo',
  }

  beforeEach(() => {
    ctxRepo.findWorkspace.mockResolvedValue(
      ok({ id: 'ws1', name: 'WS', slug: 'acme' }),
    )
    notifications.notifyUsers.mockResolvedValue(ok(2))
  })

  it('builds the href', () => {
    expect(sdTicketHref('acme', 7)).toBe('/acme/servicedesk/tickets/7')
  })

  it('skips when there is nobody to notify', async () => {
    expect(
      expectOk(
        await SdTicketNotifier.notify({
          ...base,
          userIds: [null, undefined, 'a'],
          excludeUserIds: ['a'],
        }),
      ),
    ).toBe(0)
    expect(notifications.notifyUsers).not.toHaveBeenCalled()
  })

  it('logs and returns 0 when the workspace is missing', async () => {
    ctxRepo.findWorkspace.mockResolvedValue(ok(null))
    expect(
      expectOk(await SdTicketNotifier.notify({ ...base, userIds: ['a'] })),
    ).toBe(0)
    ctxRepo.findWorkspace.mockResolvedValue(err(databaseError()))
    expect(
      expectOk(await SdTicketNotifier.notify({ ...base, userIds: ['a'] })),
    ).toBe(0)
    expect(logger.warn).toHaveBeenCalledWith(
      'servicedesk.notify.workspace_missing',
      { workspaceId: 'ws1' },
    )
  })

  it('creates in-app notifications (deduped) with the ticket href', async () => {
    expect(
      expectOk(
        await SdTicketNotifier.notify({ ...base, userIds: ['a', 'b', 'a'] }),
      ),
    ).toBe(2)
    expect(notifications.notifyUsers).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      userIds: ['a', 'b'],
      kind: 'SD_TICKET_ASSIGNED',
      title: 'Atribuído',
      body: 'corpo',
      href: '/acme/servicedesk/tickets/7',
    })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('logs in-app failures and still sends e-mails, logging e-mail failures', async () => {
    notifications.notifyUsers.mockResolvedValue(err(databaseError()))
    ctxRepo.findUserNames.mockResolvedValue(
      ok(
        new Map([
          ['a', { name: 'A', email: 'a@x' }],
          ['b', { name: 'B', email: 'b@x' }],
        ]),
      ),
    )
    sendEmail.mockResolvedValueOnce({ id: '1' } as never)
    sendEmail.mockRejectedValueOnce(new Error('smtp'))
    expect(
      expectOk(
        await SdTicketNotifier.notify({
          ...base,
          userIds: ['a', 'b'],
          email: true,
        }),
      ),
    ).toBe(0)
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'a@x',
        workspaceName: 'WS',
        ticketCode: 'INC-000007',
        redirectUrl: 'https://steel.test/acme/servicedesk/tickets/7',
      }),
    )
    expect(logger.error).toHaveBeenCalledWith(
      'servicedesk.notify.in_app_failed',
      expect.any(Object),
    )
    expect(logger.warn).toHaveBeenCalledWith(
      'servicedesk.notify.email_failed',
      expect.objectContaining({ failed: 1 }),
    )
  })

  it('skips e-mails when user lookup fails; no warning when all sent', async () => {
    ctxRepo.findUserNames.mockResolvedValue(err(databaseError()))
    await SdTicketNotifier.notify({ ...base, userIds: ['a'], email: true })
    expect(sendEmail).not.toHaveBeenCalled()
    ctxRepo.findUserNames.mockResolvedValue(
      ok(new Map([['a', { name: 'A', email: 'a@x' }]])),
    )
    sendEmail.mockResolvedValue({ id: '1' } as never)
    await SdTicketNotifier.notify({ ...base, userIds: ['a'], email: true })
    expect(logger.warn).not.toHaveBeenCalledWith(
      'servicedesk.notify.email_failed',
      expect.anything(),
    )
  })
})

describe('SdTicketEventService.list', () => {
  function asAgent() {
    vi.mocked(MembershipRepository).findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'MEMBER' })),
    )
    vi.mocked(SdAccessRepository).listDepartmentLinks.mockResolvedValue(
      ok([{ departmentId: 'd1', parentId: null, isLead: false }]),
    )
  }

  it('denies requesters', async () => {
    vi.mocked(MembershipRepository).findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'MEMBER' })),
    )
    vi.mocked(SdAccessRepository).listDepartmentLinks.mockResolvedValue(ok([]))
    expectErr(
      await SdTicketEventService.list('u1', 'ws1', 't1', { limit: 50 }),
      'SD_NOT_AGENT',
    )
  })

  it('propagates ticket and repository errors', async () => {
    asAgent()
    vi.mocked(SdTicketEngine.resolveRef).mockResolvedValue(err(databaseError()))
    expectErr(await SdTicketEventService.list('u1', 'ws1', 't1', { limit: 50 }))
    vi.mocked(SdTicketEngine.resolveRef).mockResolvedValue(
      ok(createFakeSdTicket({ id: 't1' })),
    )
    eventRepo.listByTicket.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdTicketEventService.list('u1', 'ws1', 't1', { limit: 50 }),
      'DATABASE_ERROR',
    )
  })

  it('returns the page of events', async () => {
    asAgent()
    vi.mocked(SdTicketEngine.resolveRef).mockResolvedValue(
      ok(createFakeSdTicket({ id: 't1' })),
    )
    eventRepo.listByTicket.mockResolvedValue(
      ok({ items: [createFakeSdTicketEvent({ id: 'e1' })], nextCursor: 'e1' }),
    )
    const page = expectOk(
      await SdTicketEventService.list('u1', 'ws1', 'INC-1', {
        limit: 1,
        cursor: 'e0',
      }),
    )
    expect(page.items[0].id).toBe('e1')
    expect(page.nextCursor).toBe('e1')
    expect(eventRepo.listByTicket).toHaveBeenCalledWith('t1', {
      cursor: 'e0',
      limit: 1,
    })
  })
})
