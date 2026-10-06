import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSdSettings } from '@/src/__tests__/factories/sd-ticket-context.factory'
import {
  createFakeSdTicketApproval,
  createFakeSdTicketApprovalWithTicket,
} from '@/src/__tests__/factories/sd-ticket-tabs.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { sdTabScope } from '@/src/__tests__/helpers/sd-ticket-tab.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { DEFAULT_SD_TICKET_PREFIXES } from '@/src/lib/servicedesk/ticket-code'

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
vi.mock('../sd-ticket-engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-ticket-engine')>()),
  SdTicketEngine: { loadConfig: vi.fn(), touchActivity: vi.fn() },
}))
vi.mock('../sd-ticket-tab-support', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-ticket-tab-support')>()),
  loadSdTicketTab: vi.fn(),
  publishSdTicketTab: vi.fn(),
}))
vi.mock('../sd-ticket-event-recorder', () => ({ recordSdTicketEvent: vi.fn() }))

import { logger } from '@/lib/axiom/logger'
import { sendSdApprovalRequestEmail } from '@/src/lib/mail/servicedesk/send-sd-approval-request'
import { SdTicketApprovalRepository } from '@/src/repositories/sd-ticket-approval.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { registerSdRoundVote } from '../sd-approval-round.service'
import { notifySdEvent } from '../sd-notification.service'
import {
  hashSdApprovalToken,
  newSdApprovalToken,
  SdTicketApprovalService,
  sdApprovalUrl,
} from '../sd-ticket-approval.service'
import { SdTicketEngine } from '../sd-ticket-engine'
import { loadSdTicketTab } from '../sd-ticket-tab-support'

const repo = vi.mocked(SdTicketApprovalRepository)
const ctxRepo = vi.mocked(SdTicketContextRepository)
const engine = vi.mocked(SdTicketEngine)
const load = vi.mocked(loadSdTicketTab)
const sendEmail = vi.mocked(sendSdApprovalRequestEmail)
const notify = vi.mocked(notifySdEvent)

const TOKEN = 'a'.repeat(43)

beforeEach(() => {
  vi.clearAllMocks()
  load.mockResolvedValue(ok(sdTabScope()))
  ctxRepo.findNonMembers.mockResolvedValue(ok([]))
  ctxRepo.findUserNames.mockResolvedValue(
    ok(
      new Map([
        ['u1', { name: 'Agente', email: 'agente@acme.test' }],
        ['boss', { name: 'Diretora', email: 'DIR@acme.test' }],
      ]),
    ),
  )
  ctxRepo.findWorkspace.mockResolvedValue(
    ok({ id: 'ws1', name: 'Acme', slug: 'acme' }),
  )
  engine.loadConfig.mockResolvedValue(
    ok({
      settings: createFakeSdSettings(),
      prefixes: DEFAULT_SD_TICKET_PREFIXES,
    }),
  )
  engine.touchActivity.mockResolvedValue(ok(undefined))
  repo.createMany.mockImplementation(async (rows) =>
    ok(
      rows.map((row, index) =>
        createFakeSdTicketApproval({ ...row, id: `a${index + 1}` }),
      ),
    ),
  )
  repo.markSent.mockResolvedValue(ok(undefined) as never)
  repo.expireOverdue.mockResolvedValue(ok([]))
  sendEmail.mockResolvedValue(undefined as never)
  notify.mockResolvedValue(ok({}) as never)
})

describe('token helpers', () => {
  it('creates a token whose hash matches and builds the public url', () => {
    const { token, hash } = newSdApprovalToken()
    expect(hashSdApprovalToken(token)).toBe(hash)
    expect(sdApprovalUrl(token)).toBe(
      `https://steel.test/servicedesk/approval/${token}`,
    )
  })
})

describe('SdTicketApprovalService.request', () => {
  const dto = {
    approvers: [
      { userId: 'boss' },
      { email: 'cfo@acme.test', name: 'CFO' },
      { email: 'dir@acme.test' },
    ],
    message: 'Compra de servidor',
    expiresInDays: 3,
  }

  it('creates one request per unique e-mail, mails them and notifies platform approvers', async () => {
    const created = expectOk(
      await SdTicketApprovalService.request('u1', 'ws1', '7', dto as never),
    )
    expect(created).toHaveLength(2)
    expect(
      repo.createMany.mock.calls[0][0].map((r) => r.approverEmail),
    ).toEqual(['dir@acme.test', 'cfo@acme.test'])
    expect(sendEmail).toHaveBeenCalledTimes(2)
    expect(repo.markSent).toHaveBeenCalledWith(['a1', 'a2'], expect.any(Date))
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'approval.requested',
        audience: 'payload',
        payload: expect.objectContaining({
          body: 'Compra de servidor',
          userIds: ['boss', null],
        }),
      }),
    )
  })

  it('keeps going when an e-mail fails and when the notice fails', async () => {
    sendEmail.mockRejectedValueOnce(new Error('smtp down'))
    sendEmail.mockRejectedValueOnce('boom')
    notify.mockResolvedValue(err(databaseError()))
    const created = expectOk(
      await SdTicketApprovalService.request('u1', 'ws1', '7', {
        ...dto,
        message: null,
      } as never),
    )
    expect(created.every((a) => a.sentAt === null)).toBe(true)
    expect(logger.warn).toHaveBeenCalledWith(
      'servicedesk.approval.email_failed',
      expect.anything(),
    )
    expect(logger.warn).toHaveBeenCalledWith(
      'servicedesk.approval.notify_failed',
      expect.anything(),
    )
  })

  it('refuses outsiders and approvers without e-mail', async () => {
    ctxRepo.findNonMembers.mockResolvedValueOnce(ok(['boss']))
    expectErr(
      await SdTicketApprovalService.request('u1', 'ws1', '7', dto as never),
      'VALIDATION_ERROR',
    )
    expectErr(
      await SdTicketApprovalService.request('u1', 'ws1', '7', {
        ...dto,
        approvers: [{ userId: 'ghost' }],
      } as never),
      'VALIDATION_ERROR',
    )
  })

  it('propagates scope and repository failures', async () => {
    load.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketApprovalService.request('u1', 'ws1', '7', dto as never),
      'DATABASE_ERROR',
    )
    ctxRepo.findNonMembers.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketApprovalService.request('u1', 'ws1', '7', dto as never),
      'DATABASE_ERROR',
    )
    ctxRepo.findUserNames.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketApprovalService.request('u1', 'ws1', '7', dto as never),
      'DATABASE_ERROR',
    )
    repo.createMany.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketApprovalService.request('u1', 'ws1', '7', dto as never),
      'DATABASE_ERROR',
    )
  })

  it('falls back on names when the mail context lookups fail', async () => {
    ctxRepo.findUserNames
      .mockResolvedValueOnce(ok(new Map()))
      .mockResolvedValueOnce(err(databaseError()))
    ctxRepo.findWorkspace.mockResolvedValueOnce(err(databaseError()))
    expectOk(
      await SdTicketApprovalService.request('u1', 'ws1', '7', {
        ...dto,
        approvers: [{ email: 'cfo@acme.test' }],
      } as never),
    )
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceName: 'Steel',
        requestedByName: 'Um agente',
      }),
    )
  })
})

describe('SdTicketApprovalService.list / cancel errors', () => {
  it('lists the requests and propagates failures', async () => {
    repo.list.mockResolvedValue(ok([createFakeSdTicketApproval()]))
    expect(
      expectOk(await SdTicketApprovalService.list('u1', 'ws1', '7')),
    ).toHaveLength(1)
    repo.list.mockResolvedValue(err(databaseError()))
    expectErr(await SdTicketApprovalService.list('u1', 'ws1', '7'))
    load.mockResolvedValueOnce(err(databaseError()))
    expectErr(await SdTicketApprovalService.list('u1', 'ws1', '7'))
  })

  it('propagates cancel failures', async () => {
    load.mockResolvedValueOnce(err(databaseError()))
    expectErr(await SdTicketApprovalService.cancel('u1', 'ws1', '7', 'a1'))
    repo.findById.mockResolvedValueOnce(err(databaseError()))
    expectErr(await SdTicketApprovalService.cancel('u1', 'ws1', '7', 'a1'))
    repo.findById.mockResolvedValueOnce(ok(createFakeSdTicketApproval()))
    repo.cancel.mockResolvedValueOnce(err(databaseError()))
    expectErr(await SdTicketApprovalService.cancel('u1', 'ws1', '7', 'a1'))
  })
})

describe('SdTicketApprovalService.resend', () => {
  beforeEach(() => {
    repo.findById.mockResolvedValue(
      ok(createFakeSdTicketApproval({ id: 'a1', status: 'EXPIRED' })),
    )
    repo.renewToken.mockResolvedValue(
      ok(createFakeSdTicketApproval({ id: 'a1', status: 'PENDING' })),
    )
  })

  it('renews the token and mails it again', async () => {
    const dto = expectOk(
      await SdTicketApprovalService.resend('u1', 'ws1', '7', 'a1', {
        expiresInDays: 5,
      }),
    )
    expect(repo.renewToken).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ tokenHash: expect.any(String) }),
    )
    expect(repo.markSent).toHaveBeenCalledWith(['a1'], expect.any(Date))
    expect(dto.sentAt).not.toBeNull()
  })

  it('reports an undelivered resend without marking it sent', async () => {
    sendEmail.mockRejectedValueOnce(new Error('smtp'))
    const dto = expectOk(
      await SdTicketApprovalService.resend('u1', 'ws1', '7', 'a1', {
        expiresInDays: 5,
      }),
    )
    expect(dto.sentAt).toBeNull()
    expect(repo.markSent).not.toHaveBeenCalled()
  })

  it('refuses a decided request and propagates failures', async () => {
    repo.findById.mockResolvedValueOnce(
      ok(createFakeSdTicketApproval({ status: 'APPROVED' })),
    )
    expectErr(
      await SdTicketApprovalService.resend('u1', 'ws1', '7', 'a1', {
        expiresInDays: 5,
      }),
      'SD_APPROVAL_NOT_PENDING',
    )
    repo.renewToken.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketApprovalService.resend('u1', 'ws1', '7', 'a1', {
        expiresInDays: 5,
      }),
    )
    repo.findById.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketApprovalService.resend('u1', 'ws1', '7', 'a1', {
        expiresInDays: 5,
      }),
    )
    load.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketApprovalService.resend('u1', 'ws1', '7', 'a1', {
        expiresInDays: 5,
      }),
    )
  })
})

describe('SdTicketApprovalService public link', () => {
  const pending = (overrides = {}) =>
    createFakeSdTicketApprovalWithTicket({
      id: 'a1',
      status: 'PENDING',
      approverUserId: 'boss',
      requestedById: 'u1',
      expiresAt: new Date(Date.now() + 86_400_000),
      ...overrides,
    })

  beforeEach(() => {
    repo.findByTokenHash.mockResolvedValue(ok(pending()))
    repo.respond.mockResolvedValue(ok({ responded: true, canceledIds: [] }))
  })

  it('previews the request, expiring it lazily when overdue', async () => {
    expectOk(await SdTicketApprovalService.publicPreview(TOKEN))
    expect(repo.findByTokenHash).toHaveBeenCalledWith(
      hashSdApprovalToken(TOKEN),
    )

    repo.findByTokenHash.mockResolvedValue(
      ok(pending({ expiresAt: new Date(Date.now() - 1000) })),
    )
    const preview = expectOk(await SdTicketApprovalService.publicPreview(TOKEN))
    expect(preview.status).toBe('EXPIRED')
    expect(repo.expireOverdue).toHaveBeenCalledWith(
      { id: 'a1' },
      expect.any(Date),
    )
  })

  it('propagates preview failures', async () => {
    repo.findByTokenHash.mockResolvedValueOnce(err(databaseError()))
    expectErr(await SdTicketApprovalService.publicPreview(TOKEN))
    engine.loadConfig.mockResolvedValueOnce(err(databaseError()))
    expectErr(await SdTicketApprovalService.publicPreview(TOKEN))
  })

  it('records the decision and tells who asked', async () => {
    const result = expectOk(
      await SdTicketApprovalService.respond(TOKEN, {
        decision: 'APPROVED',
        comment: 'ok',
      }),
    )
    expect(result.status).toBe('APPROVED')
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'approval.responded',
        actorId: 'boss',
        payload: expect.objectContaining({ body: 'ok', userIds: ['u1'] }),
      }),
    )
    expect(registerSdRoundVote).not.toHaveBeenCalled()
  })

  it('re-tallies a committee vote and words a rejection', async () => {
    repo.findByTokenHash.mockResolvedValue(ok(pending({ roundId: 'r1' })))
    expectOk(
      await SdTicketApprovalService.respond(TOKEN, { decision: 'REJECTED' }),
    )
    expect(registerSdRoundVote).toHaveBeenCalledWith('a1')
    expect(notify.mock.calls[0][0].payload.title).toContain('reprovou')
  })

  it('refuses expired, decided and raced requests', async () => {
    repo.findByTokenHash.mockResolvedValueOnce(
      ok(pending({ status: 'EXPIRED' })),
    )
    expectErr(
      await SdTicketApprovalService.respond(TOKEN, { decision: 'APPROVED' }),
      'SD_APPROVAL_EXPIRED',
    )
    repo.findByTokenHash.mockResolvedValueOnce(
      ok(pending({ status: 'APPROVED' })),
    )
    expectErr(
      await SdTicketApprovalService.respond(TOKEN, { decision: 'APPROVED' }),
      'SD_APPROVAL_NOT_PENDING',
    )
    repo.respond.mockResolvedValueOnce(
      ok({ responded: false, canceledIds: [] }),
    )
    expectErr(
      await SdTicketApprovalService.respond(TOKEN, { decision: 'APPROVED' }),
      'SD_APPROVAL_NOT_PENDING',
    )
  })

  it('propagates respond failures', async () => {
    repo.findByTokenHash.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketApprovalService.respond(TOKEN, { decision: 'APPROVED' }),
    )
    repo.respond.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketApprovalService.respond(TOKEN, { decision: 'APPROVED' }),
    )
    engine.loadConfig.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketApprovalService.respond(TOKEN, { decision: 'APPROVED' }),
    )
  })
})
