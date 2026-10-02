import { createId } from '@paralleldrive/cuid2'
import { describe, expect, it } from 'vitest'
import {
  seedSdApprovalRound,
  seedSdCabBoard,
  seedSdRoundApproval,
} from '@/src/__tests__/factories/sd-change.factory'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import { seedSdPhase } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdApprovalRoundRepository } from '../sd-approval-round.repository'

const DAY = 24 * 60 * 60 * 1000

async function setup() {
  const [workspace, admin, ana, bruno] = await Promise.all([
    seedWorkspace(),
    seedUser(),
    seedUser(),
    seedUser(),
  ])
  const phase = await seedSdPhase(workspace.id, { name: 'Aprovação' })
  const ticket = await seedSdTicket(workspace.id, phase.id, { type: 'CHANGE' })
  const board = await seedSdCabBoard(workspace.id, admin.id)
  return { workspace, admin, ana, bruno, ticket, board }
}

const statusOf = async (id: string) =>
  (await prisma.sdApprovalRound.findUniqueOrThrow({ where: { id } })).status

describe('SdApprovalRoundRepository', () => {
  it('opens a round with one approval per member', async () => {
    const { workspace, admin, ana, bruno, ticket, board } = await setup()
    const expiresAt = new Date(Date.now() + 7 * DAY)

    const round = expectOk(
      await SdApprovalRoundRepository.open({
        workspaceId: workspace.id,
        ticketId: ticket.id,
        boardId: board.id,
        quorum: 2,
        rejectEnds: true,
        requestedById: admin.id,
        message: 'Aprovar a mudança?',
        expiresAt,
        members: [
          {
            approverName: 'Ana',
            approverEmail: 'ana@example.com',
            approverUserId: ana.id,
            tokenHash: createId(),
            required: true,
          },
          {
            approverName: 'Bruno',
            approverEmail: 'bruno@example.com',
            approverUserId: bruno.id,
            tokenHash: createId(),
            required: false,
          },
        ],
      }),
    )

    expect(round.status).toBe('PENDING')
    expect(round.quorum).toBe(2)
    expect(round.board?.name).toBe('CAB de infraestrutura')
    expect(round.requestedBy?.id).toBe(admin.id)
    expect(round.approvals).toHaveLength(2)
    expect(round.approvals.map((a) => a.approverEmail)).toEqual([
      'ana@example.com',
      'bruno@example.com',
    ])
    expect(round.approvals.every((a) => a.roundId === round.id)).toBe(true)
    expect(
      round.approvals.every((a) => a.message === 'Aprovar a mudança?'),
    ).toBe(true)
    expect(round.approvals[0]?.expiresAt.getTime()).toBe(expiresAt.getTime())
  })

  it('lists the rounds of a ticket newest first and finds one by id', async () => {
    const { workspace, admin, ticket } = await setup()
    const older = await seedSdApprovalRound(workspace.id, ticket.id, admin.id, {
      createdAt: new Date(Date.now() - DAY),
      status: 'REJECTED',
    })
    const newer = await seedSdApprovalRound(workspace.id, ticket.id, admin.id)

    const rows = expectOk(
      await SdApprovalRoundRepository.listByTicket(ticket.id),
    )
    expect(rows.map((r) => r.id)).toEqual([newer.id, older.id])

    expect(
      expectOk(await SdApprovalRoundRepository.findById(newer.id, ticket.id))
        .id,
    ).toBe(newer.id)
    expect(
      expectErr(await SdApprovalRoundRepository.findById(newer.id, 'outro'))
        .code,
    ).toBe('SD_APPROVAL_ROUND_NOT_FOUND')
  })

  it('finds the open round and the round of one approval', async () => {
    const { workspace, admin, ticket } = await setup()
    await seedSdApprovalRound(workspace.id, ticket.id, admin.id, {
      status: 'APPROVED',
    })
    const open = await seedSdApprovalRound(workspace.id, ticket.id, admin.id)
    const approval = await seedSdRoundApproval(
      workspace.id,
      ticket.id,
      open.id,
      admin.id,
    )

    expect(
      expectOk(await SdApprovalRoundRepository.findOpenByTicket(ticket.id))?.id,
    ).toBe(open.id)
    expect(
      expectOk(await SdApprovalRoundRepository.findByApprovalId(approval.id))
        ?.id,
    ).toBe(open.id)
    expect(
      expectOk(await SdApprovalRoundRepository.findByApprovalId('nope')),
    ).toBeNull()
  })

  it('findOpenByTicket returns null when every round is closed', async () => {
    const { workspace, admin, ticket } = await setup()
    await seedSdApprovalRound(workspace.id, ticket.id, admin.id, {
      status: 'CANCELED',
    })
    expect(
      expectOk(await SdApprovalRoundRepository.findOpenByTicket(ticket.id)),
    ).toBeNull()
  })

  it('reports whether the ticket has an approved round', async () => {
    const { workspace, admin, ticket } = await setup()
    expect(
      expectOk(await SdApprovalRoundRepository.hasApprovedRound(ticket.id)),
    ).toBe(false)

    await seedSdApprovalRound(workspace.id, ticket.id, admin.id, {
      status: 'APPROVED',
    })
    expect(
      expectOk(await SdApprovalRoundRepository.hasApprovedRound(ticket.id)),
    ).toBe(true)
  })

  it('closes an open round once and refuses the second time', async () => {
    const { workspace, admin, ticket } = await setup()
    const round = await seedSdApprovalRound(workspace.id, ticket.id, admin.id)
    const at = new Date()

    expect(
      expectOk(await SdApprovalRoundRepository.close(round.id, 'APPROVED', at)),
    ).toBe(true)
    expect(await statusOf(round.id)).toBe('APPROVED')
    expect(
      expectOk(await SdApprovalRoundRepository.close(round.id, 'REJECTED', at)),
    ).toBe(false)
    expect(await statusOf(round.id)).toBe('APPROVED')
  })

  it('cancels only the pending approvals of the round', async () => {
    const { workspace, admin, ticket } = await setup()
    const round = await seedSdApprovalRound(workspace.id, ticket.id, admin.id)
    const pending = await seedSdRoundApproval(
      workspace.id,
      ticket.id,
      round.id,
      admin.id,
    )
    const decided = await seedSdRoundApproval(
      workspace.id,
      ticket.id,
      round.id,
      admin.id,
      { status: 'APPROVED' },
    )

    expect(
      expectOk(
        await SdApprovalRoundRepository.cancelPendingApprovals(round.id),
      ),
    ).toBe(1)
    const rows = await prisma.sdTicketApproval.findMany({
      where: { id: { in: [pending.id, decided.id] } },
      orderBy: { id: 'asc' },
    })
    expect(new Map(rows.map((r) => [r.id, r.status]))).toEqual(
      new Map([
        [pending.id, 'CANCELED'],
        [decided.id, 'APPROVED'],
      ]),
    )
  })

  it('expires a round whose pending approvals are all overdue', async () => {
    const { workspace, admin, ticket } = await setup()
    const stale = await seedSdApprovalRound(workspace.id, ticket.id, admin.id)
    const overdue = await seedSdRoundApproval(
      workspace.id,
      ticket.id,
      stale.id,
      admin.id,
      { expiresAt: new Date(Date.now() - DAY) },
    )
    const now = new Date()

    expect(
      expectOk(await SdApprovalRoundRepository.expireOverdue(ticket.id, now)),
    ).toBe(1)
    expect(await statusOf(stale.id)).toBe('EXPIRED')
    const approval = await prisma.sdTicketApproval.findUniqueOrThrow({
      where: { id: overdue.id },
    })
    expect(approval.status).toBe('EXPIRED')
  })

  it('does not expire a round that still has a live approval', async () => {
    const { workspace, admin, ticket } = await setup()
    const round = await seedSdApprovalRound(workspace.id, ticket.id, admin.id)
    await seedSdRoundApproval(workspace.id, ticket.id, round.id, admin.id, {
      expiresAt: new Date(Date.now() - DAY),
    })
    await seedSdRoundApproval(workspace.id, ticket.id, round.id, admin.id)

    expect(
      expectOk(
        await SdApprovalRoundRepository.expireOverdue(ticket.id, new Date()),
      ),
    ).toBe(0)
    expect(await statusOf(round.id)).toBe('PENDING')
  })

  it('does not expire a round whose approvals are already decided', async () => {
    const { workspace, admin, ticket } = await setup()
    const round = await seedSdApprovalRound(workspace.id, ticket.id, admin.id)
    await seedSdRoundApproval(workspace.id, ticket.id, round.id, admin.id, {
      status: 'APPROVED',
      expiresAt: new Date(Date.now() - DAY),
    })

    expect(
      expectOk(
        await SdApprovalRoundRepository.expireOverdue(ticket.id, new Date()),
      ),
    ).toBe(0)
    expect(await statusOf(round.id)).toBe('PENDING')
  })

  it('lists the open round ids of a ticket', async () => {
    const { workspace, admin, ticket } = await setup()
    const open = await seedSdApprovalRound(workspace.id, ticket.id, admin.id)
    await seedSdApprovalRound(workspace.id, ticket.id, admin.id, {
      status: 'EXPIRED',
    })

    expect(
      expectOk(await SdApprovalRoundRepository.listOpenIds(ticket.id)),
    ).toEqual([open.id])
  })
})
