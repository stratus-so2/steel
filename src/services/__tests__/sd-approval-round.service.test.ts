import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeSdApprovalRound,
  createFakeSdCabBoard,
  createFakeSdCabMember,
} from '@/src/__tests__/factories/sd-change.factory'
import { createFakeSdTicketApproval } from '@/src/__tests__/factories/sd-ticket-tabs.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { sdTabScope } from '@/src/__tests__/helpers/sd-ticket-tab.helpers'
import { databaseError, sdNotAgent } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { OpenSdApprovalRoundSchema } from '@/src/schemas/sd-approval-round.schema'

vi.mock('@/lib/axiom/audit')
vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/src/repositories/sd-approval-round.repository')
vi.mock('@/src/repositories/sd-cab-board.repository')
vi.mock('@/src/repositories/sd-ticket-context.repository')
vi.mock('@/src/lib/mail/servicedesk/send-sd-approval-request', () => ({
  sendSdApprovalRequestEmail: vi.fn(),
}))
vi.mock('../sd-notification.service', () => ({
  notifySdEvent: vi.fn(async () => ({ ok: true, value: {} })),
}))
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
vi.mock('../sd-approval-notify', () => ({
  notifySdApprovalCanceled: vi.fn(async () => undefined),
  notifySdApprovalsExpired: vi.fn(async () => undefined),
}))

import { auditMutation } from '@/lib/axiom/audit'
import { sendSdApprovalRequestEmail } from '@/src/lib/mail/servicedesk/send-sd-approval-request'
import { SdApprovalRoundRepository } from '@/src/repositories/sd-approval-round.repository'
import { SdCabBoardRepository } from '@/src/repositories/sd-cab-board.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import {
  notifySdApprovalCanceled,
  notifySdApprovalsExpired,
} from '../sd-approval-notify'
import {
  registerSdRoundVote,
  SdApprovalRoundService,
  settleSdApprovalRound,
} from '../sd-approval-round.service'
import { notifySdEvent } from '../sd-notification.service'
import { recordSdTicketEvent } from '../sd-ticket-event-recorder'
import { loadSdTicketTab } from '../sd-ticket-tab-support'

const load = vi.mocked(loadSdTicketTab)
const repo = vi.mocked(SdApprovalRoundRepository)
const boardRepo = vi.mocked(SdCabBoardRepository)
const ctxRepo = vi.mocked(SdTicketContextRepository)
const record = vi.mocked(recordSdTicketEvent)
const sendEmail = vi.mocked(sendSdApprovalRequestEmail)
const notify = vi.mocked(notifySdEvent)

const input = OpenSdApprovalRoundSchema.parse({})

const board = () =>
  createFakeSdCabBoard({
    id: 'board1',
    quorum: 0,
    members: [
      createFakeSdCabMember({ id: 'm1', userId: 'ana', required: true }),
      createFakeSdCabMember({ id: 'm2', userId: 'bruno' }),
    ],
  })

const names = () =>
  new Map([
    ['u1', { name: 'Quem pediu', email: 'pediu@example.com' }],
    ['ana', { name: 'Ana', email: 'ANA@example.com' }],
    ['bruno', { name: 'Bruno', email: 'bruno@example.com' }],
  ])

const openedRound = (overrides = {}) =>
  createFakeSdApprovalRound({
    id: 'r1',
    quorum: 2,
    board: {
      id: 'board1',
      name: 'CAB de infraestrutura',
      members: [
        { userId: 'ana', required: true },
        { userId: 'bruno', required: false },
      ],
    },
    approvals: [
      createFakeSdTicketApproval({
        id: 'a1',
        roundId: 'r1',
        approverUserId: 'ana',
        approverEmail: 'ana@example.com',
        tokenHash: 'h1',
      }),
      createFakeSdTicketApproval({
        id: 'a2',
        roundId: 'r1',
        approverUserId: 'bruno',
        approverEmail: 'bruno@example.com',
        tokenHash: 'h2',
      }),
    ],
    ...overrides,
  })

beforeEach(() => {
  load.mockResolvedValue(ok(sdTabScope()))
  repo.expireOverdue.mockResolvedValue(ok([]))
  repo.findOpenByTicket.mockResolvedValue(ok(null))
  repo.listByTicket.mockResolvedValue(ok([openedRound()]))
  repo.findById.mockResolvedValue(ok(openedRound()))
  repo.findByApprovalId.mockResolvedValue(ok(openedRound()))
  repo.close.mockResolvedValue(ok(true))
  repo.cancelPendingApprovals.mockResolvedValue(ok(1))
  repo.open.mockImplementation(async (params) =>
    ok(
      openedRound({
        quorum: params.quorum,
        rejectEnds: params.rejectEnds,
        approvals: params.members.map((member, index) =>
          createFakeSdTicketApproval({
            id: `a${index + 1}`,
            roundId: 'r1',
            approverUserId: member.approverUserId,
            approverEmail: member.approverEmail,
            tokenHash: member.tokenHash,
          }),
        ),
      }),
    ),
  )
  boardRepo.list.mockResolvedValue(ok([board()]))
  ctxRepo.findUserNames.mockResolvedValue(ok(names()))
  ctxRepo.findWorkspace.mockResolvedValue(
    ok({ id: 'ws1', name: 'Acme', slug: 'acme' }),
  )
  record.mockResolvedValue(ok(1))
  notify.mockResolvedValue(ok({}) as never)
  sendEmail.mockResolvedValue(undefined as never)
})

describe('SdApprovalRoundService.list', () => {
  it('lists the rounds with their tally, expiring the overdue ones first', async () => {
    const list = expectOk(await SdApprovalRoundService.list('u1', 'ws1', '7'))
    expect(repo.expireOverdue).toHaveBeenCalledWith('t1', expect.any(Date))
    expect(list[0].tally).toMatchObject({ total: 2, pending: 2, remaining: 2 })
  })

  it('refuses a requester and propagates db errors', async () => {
    load.mockResolvedValue(err(sdNotAgent()))
    expectErr(
      await SdApprovalRoundService.list('u1', 'ws1', '7'),
      'SD_NOT_AGENT',
    )
    load.mockResolvedValue(ok(sdTabScope()))
    repo.listByTicket.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdApprovalRoundService.list('u1', 'ws1', '7'),
      'DATABASE_ERROR',
    )
  })

  it('does not break when the lazy expiry fails', async () => {
    repo.expireOverdue.mockResolvedValue(err(databaseError()))
    expectOk(await SdApprovalRoundService.list('u1', 'ws1', '7'))
  })
})

describe('SdApprovalRoundService.open', () => {
  it('opens a round with one approval per member and sends the e-mails', async () => {
    const round = expectOk(
      await SdApprovalRoundService.open('u1', 'ws1', '7', input),
    )
    expect(repo.open).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws1',
        ticketId: 't1',
        boardId: 'board1',
        // quorum 0 do comitê = todos os membros.
        quorum: 2,
        rejectEnds: true,
        requestedById: 'u1',
      }),
    )
    const members = repo.open.mock.calls[0][0].members
    expect(members.map((m) => m.approverEmail)).toEqual([
      'ana@example.com',
      'bruno@example.com',
    ])
    expect(members[0].required).toBe(true)
    expect(sendEmail).toHaveBeenCalledTimes(2)
    expect(sendEmail.mock.calls[0][0].approveUrl).toContain(
      '?decision=APPROVED',
    )
    expect(round.quorum).toBe(2)
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'approval_round.opened' }),
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_approval_round',
        action: 'create',
      }),
    )
  })

  it('honours an explicit committee and its quorum', async () => {
    boardRepo.list.mockResolvedValue(
      ok([
        createFakeSdCabBoard({ id: 'outro', conditions: [] }),
        createFakeSdCabBoard({
          ...board(),
          id: 'escolhido',
          quorum: 1,
          rejectEnds: false,
        }),
      ]),
    )
    expectOk(
      await SdApprovalRoundService.open('u1', 'ws1', '7', {
        ...input,
        boardId: 'escolhido',
      }),
    )
    expect(repo.open).toHaveBeenCalledWith(
      expect.objectContaining({
        boardId: 'escolhido',
        quorum: 1,
        rejectEnds: false,
      }),
    )
  })

  it('picks the committee by conditions', async () => {
    boardRepo.list.mockResolvedValue(
      ok([
        createFakeSdCabBoard({
          ...board(),
          id: 'alto-risco',
          conditions: [
            { field: 'changeRisk', operator: 'equals', value: 'VERY_HIGH' },
          ],
        }),
        createFakeSdCabBoard({ ...board(), id: 'padrao', conditions: [] }),
      ]),
    )
    expectOk(await SdApprovalRoundService.open('u1', 'ws1', '7', input))
    expect(repo.open).toHaveBeenCalledWith(
      expect.objectContaining({ boardId: 'padrao' }),
    )
  })

  it('refuses an unknown explicit committee', async () => {
    expectErr(
      await SdApprovalRoundService.open('u1', 'ws1', '7', {
        ...input,
        boardId: 'nope',
      }),
      'SD_CAB_BOARD_NOT_FOUND',
    )
  })

  it('explains when no committee matches the ticket', async () => {
    boardRepo.list.mockResolvedValue(
      ok([
        createFakeSdCabBoard({
          ...board(),
          conditions: [
            { field: 'changeRisk', operator: 'equals', value: 'VERY_HIGH' },
          ],
        }),
      ]),
    )
    const e = expectErr(
      await SdApprovalRoundService.open('u1', 'ws1', '7', input),
      'SD_CAB_BOARD_NOT_FOUND',
    )
    expect(e.message).toContain('Configurações › Mudanças')
  })

  it('refuses a second open round on the same ticket', async () => {
    repo.findOpenByTicket.mockResolvedValue(ok(openedRound()))
    expectErr(
      await SdApprovalRoundService.open('u1', 'ws1', '7', input),
      'SD_APPROVAL_ROUND_CLOSED',
    )
  })

  it('refuses an explicit committee with no members', async () => {
    boardRepo.list.mockResolvedValue(
      ok([createFakeSdCabBoard({ id: 'vazio', members: [] })]),
    )
    expectErr(
      await SdApprovalRoundService.open('u1', 'ws1', '7', {
        ...input,
        boardId: 'vazio',
      }),
      'SD_CAB_QUORUM_INVALID',
    )
  })

  it('refuses when no member has an e-mail', async () => {
    ctxRepo.findUserNames.mockResolvedValue(ok(new Map()))
    const e = expectErr(
      await SdApprovalRoundService.open('u1', 'ws1', '7', input),
      'SD_CAB_QUORUM_INVALID',
    )
    expect(e.message).toContain('e-mail cadastrado')
  })

  it('skips a member without an e-mail and clamps the quorum', async () => {
    ctxRepo.findUserNames.mockResolvedValue(
      ok(new Map([['ana', { name: 'Ana', email: 'ana@example.com' }]])),
    )
    expectOk(await SdApprovalRoundService.open('u1', 'ws1', '7', input))
    expect(repo.open).toHaveBeenCalledWith(
      expect.objectContaining({ quorum: 1 }),
    )
    expect(repo.open.mock.calls[0][0].members).toHaveLength(1)
  })

  it('survives an e-mail that fails to send', async () => {
    sendEmail.mockRejectedValueOnce(new Error('smtp down'))
    expectOk(await SdApprovalRoundService.open('u1', 'ws1', '7', input))
    const event = record.mock.calls
      .map(([e]) => e)
      .find((e) => !Array.isArray(e) && e.action === 'approval_round.opened')
    expect(event).toMatchObject({ meta: expect.objectContaining({ sent: 1 }) })
  })

  it('falls back to defaults when the workspace and the requester are unknown', async () => {
    ctxRepo.findWorkspace.mockResolvedValue(ok(null))
    expectOk(await SdApprovalRoundService.open('u1', 'ws1', '7', input))
    expect(sendEmail.mock.calls[0][0].workspaceName).toBe('Steel')
    expect(sendEmail.mock.calls[0][0].requestedByName).toBe('Quem pediu')
    ctxRepo.findWorkspace.mockResolvedValue(err(databaseError()))
    ctxRepo.findUserNames.mockResolvedValue(
      ok(new Map([['ana', { name: 'Ana', email: 'ana@example.com' }]])),
    )
    sendEmail.mockClear()
    expectOk(await SdApprovalRoundService.open('u1', 'ws1', '7', input))
    expect(sendEmail.mock.calls[0][0].workspaceName).toBe('Steel')
    expect(sendEmail.mock.calls[0][0].requestedByName).toBe('Um agente')
  })

  it('refuses a requester and a closed ticket, and propagates db errors', async () => {
    load.mockResolvedValue(err(sdNotAgent()))
    expectErr(
      await SdApprovalRoundService.open('u1', 'ws1', '7', input),
      'SD_NOT_AGENT',
    )
    load.mockResolvedValue(ok(sdTabScope()))
    repo.findOpenByTicket.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdApprovalRoundService.open('u1', 'ws1', '7', input),
      'DATABASE_ERROR',
    )
    repo.findOpenByTicket.mockResolvedValue(ok(null))
    boardRepo.list.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdApprovalRoundService.open('u1', 'ws1', '7', input),
      'DATABASE_ERROR',
    )
    boardRepo.list.mockResolvedValue(ok([board()]))
    ctxRepo.findUserNames.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdApprovalRoundService.open('u1', 'ws1', '7', input),
      'DATABASE_ERROR',
    )
    ctxRepo.findUserNames.mockResolvedValue(ok(names()))
    repo.open.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdApprovalRoundService.open('u1', 'ws1', '7', input),
      'DATABASE_ERROR',
    )
  })

  it('survives a failing notification and a non-Error e-mail throw', async () => {
    notify.mockResolvedValue(err(databaseError()) as never)
    sendEmail.mockRejectedValueOnce('boom')
    expectOk(await SdApprovalRoundService.open('u1', 'ws1', '7', input))
  })

  it('skips an approval whose token it does not hold', async () => {
    repo.open.mockResolvedValue(
      ok(
        openedRound({
          approvals: [
            createFakeSdTicketApproval({ id: 'a9', tokenHash: 'desconhecido' }),
          ],
        }),
      ),
    )
    expectOk(await SdApprovalRoundService.open('u1', 'ws1', '7', input))
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('falls back to "Um agente" when the second name lookup fails', async () => {
    ctxRepo.findUserNames
      .mockResolvedValueOnce(ok(names()))
      .mockResolvedValueOnce(err(databaseError()))
    expectOk(await SdApprovalRoundService.open('u1', 'ws1', '7', input))
    expect(sendEmail.mock.calls[0][0].requestedByName).toBe('Um agente')
  })

  it('uses the message as the notification body and the e-mail text', async () => {
    expectOk(
      await SdApprovalRoundService.open('u1', 'ws1', '7', {
        ...input,
        message: 'Aprovar até sexta',
      }),
    )
    expect(sendEmail.mock.calls[0][0].message).toBe('Aprovar até sexta')
  })
})

describe('settleSdApprovalRound', () => {
  it('leaves an open round alone while the quorum is short', async () => {
    expect(expectOk(await settleSdApprovalRound(openedRound()))).toBeNull()
    expect(repo.close).not.toHaveBeenCalled()
  })

  it('ignores a round that is already closed', async () => {
    expect(
      expectOk(
        await settleSdApprovalRound(openedRound({ status: 'APPROVED' })),
      ),
    ).toBeNull()
  })

  it('closes as approved and cancels what was left', async () => {
    const round = openedRound({
      quorum: 1,
      approvals: [
        createFakeSdTicketApproval({
          id: 'a1',
          roundId: 'r1',
          approverUserId: 'ana',
          status: 'APPROVED',
        }),
      ],
      board: {
        id: 'board1',
        name: 'CAB',
        members: [{ userId: 'ana', required: true }],
      },
    })
    expect(expectOk(await settleSdApprovalRound(round))).toBe('APPROVED')
    expect(repo.close).toHaveBeenCalledWith('r1', 'APPROVED', expect.any(Date))
    expect(repo.cancelPendingApprovals).toHaveBeenCalledWith('r1')
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'approval_round.closed',
        toValue: 'APPROVED',
      }),
    )
  })

  it('closes as rejected on the first rejection when rejectEnds', async () => {
    const round = openedRound({
      approvals: [
        createFakeSdTicketApproval({
          id: 'a1',
          roundId: 'r1',
          approverUserId: 'ana',
          status: 'REJECTED',
        }),
        createFakeSdTicketApproval({
          id: 'a2',
          roundId: 'r1',
          approverUserId: 'bruno',
        }),
      ],
    })
    expect(expectOk(await settleSdApprovalRound(round))).toBe('REJECTED')
  })

  it('gives up when it loses the race to close', async () => {
    repo.close.mockResolvedValue(ok(false))
    const round = openedRound({
      quorum: 1,
      approvals: [createFakeSdTicketApproval({ id: 'a1', status: 'APPROVED' })],
      board: null,
    })
    expect(expectOk(await settleSdApprovalRound(round))).toBeNull()
    expect(repo.cancelPendingApprovals).not.toHaveBeenCalled()
  })

  it('propagates db errors from closing and cancelling', async () => {
    const round = openedRound({
      quorum: 1,
      approvals: [createFakeSdTicketApproval({ id: 'a1', status: 'APPROVED' })],
      board: null,
    })
    repo.close.mockResolvedValue(err(databaseError()))
    expectErr(await settleSdApprovalRound(round), 'DATABASE_ERROR')
    repo.close.mockResolvedValue(ok(true))
    repo.cancelPendingApprovals.mockResolvedValue(err(databaseError()))
    expectErr(await settleSdApprovalRound(round), 'DATABASE_ERROR')
  })
})

describe('registerSdRoundVote', () => {
  it('settles the round of the approval', async () => {
    repo.findByApprovalId.mockResolvedValue(
      ok(
        openedRound({
          quorum: 1,
          approvals: [
            createFakeSdTicketApproval({ id: 'a1', status: 'APPROVED' }),
          ],
          board: null,
        }),
      ),
    )
    await registerSdRoundVote('a1')
    expect(repo.close).toHaveBeenCalledWith('r1', 'APPROVED', expect.any(Date))
  })

  it('does nothing for a standalone approval', async () => {
    repo.findByApprovalId.mockResolvedValue(ok(null))
    await registerSdRoundVote('a1')
    expect(repo.close).not.toHaveBeenCalled()
  })

  it('never throws when the lookup or the settle fails', async () => {
    repo.findByApprovalId.mockResolvedValue(err(databaseError()))
    await expect(registerSdRoundVote('a1')).resolves.toBeUndefined()
    repo.findByApprovalId.mockResolvedValue(
      ok(
        openedRound({
          quorum: 1,
          approvals: [
            createFakeSdTicketApproval({ id: 'a1', status: 'APPROVED' }),
          ],
          board: null,
        }),
      ),
    )
    repo.close.mockResolvedValue(err(databaseError()))
    await expect(registerSdRoundVote('a1')).resolves.toBeUndefined()
  })
})

describe('SdApprovalRoundService.cancel', () => {
  it('cancels the open round and its pending approvals', async () => {
    const canceled = expectOk(
      await SdApprovalRoundService.cancel('u1', 'ws1', '7', 'r1'),
    )
    expect(repo.close).toHaveBeenCalledWith('r1', 'CANCELED', expect.any(Date))
    expect(repo.cancelPendingApprovals).toHaveBeenCalledWith('r1')
    expect(canceled.id).toBe('r1')
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'approval_round.canceled' }),
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_approval_round',
        action: 'cancel',
      }),
    )
  })

  it('labels a round whose committee was removed', async () => {
    repo.findById.mockResolvedValue(ok(openedRound({ board: null })))
    expectOk(await SdApprovalRoundService.cancel('u1', 'ws1', '7', 'r1'))
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        fromValue: { id: 'r1', label: 'Comitê removido' },
      }),
    )
  })

  it('refuses a round that is already closed', async () => {
    repo.findById.mockResolvedValue(ok(openedRound({ status: 'APPROVED' })))
    expectErr(
      await SdApprovalRoundService.cancel('u1', 'ws1', '7', 'r1'),
      'SD_APPROVAL_ROUND_CLOSED',
    )
    repo.findById.mockResolvedValue(ok(openedRound()))
    repo.close.mockResolvedValue(ok(false))
    expectErr(
      await SdApprovalRoundService.cancel('u1', 'ws1', '7', 'r1'),
      'SD_APPROVAL_ROUND_CLOSED',
    )
  })

  it('refuses a requester and propagates db errors', async () => {
    load.mockResolvedValue(err(sdNotAgent()))
    expectErr(
      await SdApprovalRoundService.cancel('u1', 'ws1', '7', 'r1'),
      'SD_NOT_AGENT',
    )
    load.mockResolvedValue(ok(sdTabScope()))
    repo.findById.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdApprovalRoundService.cancel('u1', 'ws1', '7', 'r1'),
      'DATABASE_ERROR',
    )
    repo.findById.mockResolvedValue(ok(openedRound()))
    repo.close.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdApprovalRoundService.cancel('u1', 'ws1', '7', 'r1'),
      'DATABASE_ERROR',
    )
    repo.close.mockResolvedValue(ok(true))
    repo.cancelPendingApprovals.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdApprovalRoundService.cancel('u1', 'ws1', '7', 'r1'),
      'DATABASE_ERROR',
    )
  })

  it('reports SD_APPROVAL_ROUND_NOT_FOUND when the reread fails', async () => {
    repo.findById
      .mockResolvedValueOnce(ok(openedRound()))
      .mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdApprovalRoundService.cancel('u1', 'ws1', '7', 'r1'),
      'SD_APPROVAL_ROUND_NOT_FOUND',
    )
  })
})

describe('SdApprovalRoundService · approval notices', () => {
  const canceledNotice = vi.mocked(notifySdApprovalCanceled)
  const expiredNotice = vi.mocked(notifySdApprovalsExpired)

  beforeEach(() => {
    canceledNotice.mockClear()
    expiredNotice.mockClear()
  })

  it('tells the approvers who had not voted that the round was canceled', async () => {
    repo.findById.mockResolvedValue(
      ok(
        openedRound({
          approvals: [
            createFakeSdTicketApproval({
              id: 'a1',
              roundId: 'r1',
              approverUserId: 'ana',
              status: 'APPROVED',
            }),
            createFakeSdTicketApproval({
              id: 'a2',
              roundId: 'r1',
              approverUserId: 'bruno',
            }),
          ],
        }),
      ),
    )
    expectOk(await SdApprovalRoundService.cancel('u1', 'ws1', '7', 'r1'))
    expect(canceledNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'u1',
        approverUserIds: ['bruno'],
        body: expect.stringContaining('CAB de infraestrutura'),
      }),
    )
  })

  it('names an unnamed committee generically', async () => {
    repo.findById.mockResolvedValue(ok(openedRound({ board: null })))
    expectOk(await SdApprovalRoundService.cancel('u1', 'ws1', '7', 'r1'))
    expect(canceledNotice.mock.calls[0][0].body).toContain('do comitê foi')
  })

  it('does not notify when the cancel lost the race', async () => {
    repo.close.mockResolvedValue(ok(false))
    expectErr(await SdApprovalRoundService.cancel('u1', 'ws1', '7', 'r1'))
    expect(canceledNotice).not.toHaveBeenCalled()
  })

  it('notifies the rounds that the lazy expiration moved', async () => {
    repo.expireOverdue.mockResolvedValue(
      ok([
        {
          id: 'r1',
          workspaceId: 'ws1',
          ticketId: 't1',
          requestedById: 'u1',
          boardName: 'CAB',
        },
        {
          id: 'r2',
          workspaceId: 'ws1',
          ticketId: 't1',
          requestedById: 'u2',
          boardName: null,
        },
      ]),
    )
    expectOk(await SdApprovalRoundService.list('u1', 'ws1', '7'))
    expect(expiredNotice).toHaveBeenCalledWith([
      {
        workspaceId: 'ws1',
        ticketId: 't1',
        requestedById: 'u1',
        label: 'comitê CAB',
      },
      {
        workspaceId: 'ws1',
        ticketId: 't1',
        requestedById: 'u2',
        label: 'comitê',
      },
    ])
  })

  it('stays quiet when nothing expired', async () => {
    expectOk(await SdApprovalRoundService.list('u1', 'ws1', '7'))
    expect(expiredNotice).not.toHaveBeenCalled()
  })
})
