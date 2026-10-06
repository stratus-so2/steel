import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSdTicketApproval } from '@/src/__tests__/factories/sd-ticket-tabs.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { sdTabScope } from '@/src/__tests__/helpers/sd-ticket-tab.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/audit')
vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/lib/env/env', () => ({ NEXT_PUBLIC_URL: 'https://steel.test' }))
vi.mock('@/src/repositories/sd-ticket-approval.repository')
vi.mock('@/src/repositories/sd-ticket-context.repository')
vi.mock('@/src/lib/servicedesk/realtime', () => ({
  publishSdTicketEvent: vi.fn(),
}))
vi.mock('@/src/lib/mail/servicedesk/send-sd-approval-request', () => ({
  sendSdApprovalRequestEmail: vi.fn(),
}))
vi.mock('../sd-approval-round.service', () => ({
  registerSdRoundVote: vi.fn(),
}))
vi.mock('../sd-automation-engine', () => ({ fireSdAutomations: vi.fn() }))
vi.mock('../sd-notification.service', () => ({ notifySdEvent: vi.fn() }))
vi.mock('../sd-approval-notify', () => ({
  notifySdApprovalCanceled: vi.fn(async () => undefined),
  notifySdApprovalsExpired: vi.fn(async () => undefined),
}))
vi.mock('../sd-ticket-tab-support', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-ticket-tab-support')>()),
  loadSdTicketTab: vi.fn(),
  publishSdTicketTab: vi.fn(),
}))
vi.mock('../sd-ticket-event-recorder', () => ({ recordSdTicketEvent: vi.fn() }))

import { logger } from '@/lib/axiom/logger'
import { SdTicketApprovalRepository } from '@/src/repositories/sd-ticket-approval.repository'
import {
  notifySdApprovalCanceled,
  notifySdApprovalsExpired,
} from '../sd-approval-notify'
import { SdTicketApprovalService } from '../sd-ticket-approval.service'
import { loadSdTicketTab } from '../sd-ticket-tab-support'

const repo = vi.mocked(SdTicketApprovalRepository)
const load = vi.mocked(loadSdTicketTab)
const canceledNotice = vi.mocked(notifySdApprovalCanceled)
const expiredNotice = vi.mocked(notifySdApprovalsExpired)

const expiredRow = (overrides = {}) => ({
  id: 'a1',
  workspaceId: 'ws1',
  ticketId: 't1',
  roundId: null,
  requestedById: 'u1',
  approverName: 'Diretora',
  approverEmail: 'dir@acme.test',
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  load.mockResolvedValue(ok(sdTabScope()))
  repo.expireOverdue.mockResolvedValue(ok([]))
  repo.list.mockResolvedValue(ok([]))
  repo.findById.mockResolvedValue(
    ok(
      createFakeSdTicketApproval({
        id: 'a1',
        approverUserId: 'boss',
        message: '  Aprovar compra  ',
      }),
    ),
  )
  repo.cancel.mockResolvedValue(ok(true))
})

describe('SdTicketApprovalService.cancel · notice', () => {
  it('tells the approver the request was canceled', async () => {
    expectOk(await SdTicketApprovalService.cancel('u1', 'ws1', '7', 'a1'))
    expect(canceledNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'u1',
        approverUserIds: ['boss'],
        body: 'Aprovar compra',
        code: expect.any(String),
      }),
    )
  })

  it('falls back to the ticket title without a message', async () => {
    repo.findById.mockResolvedValue(
      ok(createFakeSdTicketApproval({ id: 'a1', message: null })),
    )
    expectOk(await SdTicketApprovalService.cancel('u1', 'ws1', '7', 'a1'))
    expect(canceledNotice.mock.calls[0][0].body).toBe(sdTabScope().ticket.title)
  })

  it('does not notify when the request was no longer pending', async () => {
    repo.cancel.mockResolvedValue(ok(false))
    expectErr(
      await SdTicketApprovalService.cancel('u1', 'ws1', '7', 'a1'),
      'SD_APPROVAL_NOT_PENDING',
    )
    expect(canceledNotice).not.toHaveBeenCalled()
  })
})

describe('SdTicketApprovalService · lazy expiration notice', () => {
  it('notifies the requests this call expired', async () => {
    repo.expireOverdue.mockResolvedValue(
      ok([
        expiredRow(),
        expiredRow({ id: 'a2', approverName: null, requestedById: 'u2' }),
      ]),
    )
    expectOk(await SdTicketApprovalService.list('u1', 'ws1', '7'))
    expect(expiredNotice).toHaveBeenCalledWith([
      {
        workspaceId: 'ws1',
        ticketId: 't1',
        requestedById: 'u1',
        label: 'Diretora',
      },
      {
        workspaceId: 'ws1',
        ticketId: 't1',
        requestedById: 'u2',
        label: 'dir@acme.test',
      },
    ])
  })

  it('stays quiet when nothing expired', async () => {
    expectOk(await SdTicketApprovalService.list('u1', 'ws1', '7'))
    expect(expiredNotice).not.toHaveBeenCalled()
  })

  it('logs and goes on when the expiration fails', async () => {
    repo.expireOverdue.mockResolvedValue(err(databaseError()))
    expectOk(await SdTicketApprovalService.list('u1', 'ws1', '7'))
    expect(expiredNotice).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      'servicedesk.approval.expire_failed',
      { reason: 'DATABASE_ERROR' },
    )
  })
})
