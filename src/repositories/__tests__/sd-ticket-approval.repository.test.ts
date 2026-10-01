import { createId } from '@paralleldrive/cuid2'
import { describe, expect, it, vi } from 'vitest'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import { seedSdPhase } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { seedSdTicketApproval } from '@/src/__tests__/factories/sd-ticket-tabs.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdTicketApprovalRepository } from '../sd-ticket-approval.repository'

async function setup() {
  const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
  const phase = await seedSdPhase(workspace.id, { name: 'Aguardando' })
  const ticket = await seedSdTicket(workspace.id, phase.id)
  const other = await seedSdTicket(workspace.id, phase.id)
  return { workspace, user, ticket, other }
}

const DAY = 24 * 60 * 60 * 1000
const statusOf = async (id: string) =>
  (await prisma.sdTicketApproval.findUniqueOrThrow({ where: { id } })).status

describe('SdTicketApprovalRepository', () => {
  it('creates many, lists newest first and finds by id/token', async () => {
    const { workspace, user, ticket, other } = await setup()
    const base = {
      workspaceId: workspace.id,
      ticketId: ticket.id,
      approverName: null,
      approverUserId: null,
      message: 'Ok?',
      requestedById: user.id,
      expiresAt: new Date(Date.now() + DAY),
    }
    const created = expectOk(
      await SdTicketApprovalRepository.createMany([
        { ...base, approverEmail: 'a@example.com', tokenHash: 'h1' },
        { ...base, approverEmail: 'b@example.com', tokenHash: 'h2' },
      ]),
    )
    expect(created).toHaveLength(2)
    expect(created[0]?.requestedBy.id).toBe(user.id)
    await prisma.sdTicketApproval.update({
      where: { id: created[0]?.id },
      data: { createdAt: new Date(Date.now() - DAY) },
    })

    const rows = expectOk(await SdTicketApprovalRepository.list(ticket.id))
    expect(rows.map((r) => r.approverEmail)).toEqual([
      'b@example.com',
      'a@example.com',
    ])
    expectErr(
      await SdTicketApprovalRepository.findById(
        created[0]?.id as string,
        other.id,
      ),
      'SD_APPROVAL_NOT_FOUND',
    )
    expect(
      expectOk(
        await SdTicketApprovalRepository.findById(
          created[0]?.id as string,
          ticket.id,
        ),
      ).approverEmail,
    ).toBe('a@example.com')

    const byToken = expectOk(
      await SdTicketApprovalRepository.findByTokenHash('h2'),
    )
    expect(byToken.workspace.id).toBe(workspace.id)
    expect(byToken.ticket.phase.name).toBe('Aguardando')
    expectErr(
      await SdTicketApprovalRepository.findByTokenHash('nope'),
      'SD_APPROVAL_NOT_FOUND',
    )
    await prisma.sdTicket.update({
      where: { id: ticket.id },
      data: { deletedAt: new Date() },
    })
    expectErr(
      await SdTicketApprovalRepository.findByTokenHash('h2'),
      'SD_APPROVAL_NOT_FOUND',
    )
  })

  it('marks sent, expires lazily, renews and cancels', async () => {
    const { workspace, user, ticket } = await setup()
    const now = new Date()
    const overdue = await seedSdTicketApproval(
      workspace.id,
      ticket.id,
      user.id,
      {
        expiresAt: new Date(now.getTime() - 1000),
      },
    )
    const overdue2 = await seedSdTicketApproval(
      workspace.id,
      ticket.id,
      user.id,
      { expiresAt: new Date(now.getTime() - 1000) },
    )
    const live = await seedSdTicketApproval(workspace.id, ticket.id, user.id)

    expectOk(await SdTicketApprovalRepository.markSent([], now))
    expectOk(await SdTicketApprovalRepository.markSent([live.id], now))
    expect(
      (
        await prisma.sdTicketApproval.findUniqueOrThrow({
          where: { id: live.id },
        })
      ).sentAt,
    ).not.toBeNull()

    expect(
      expectOk(
        await SdTicketApprovalRepository.expireOverdue({ id: overdue.id }, now),
      ),
    ).toBe(1)
    expect(
      expectOk(
        await SdTicketApprovalRepository.expireOverdue(
          { ticketId: ticket.id },
          now,
        ),
      ),
    ).toBe(1)
    expect(await statusOf(overdue2.id)).toBe('EXPIRED')
    expect(await statusOf(live.id)).toBe('PENDING')

    const renewed = expectOk(
      await SdTicketApprovalRepository.renewToken(overdue.id, {
        tokenHash: createId(),
        expiresAt: new Date(now.getTime() + DAY),
      }),
    )
    expect(renewed.status).toBe('PENDING')
    expect(renewed.sentAt).toBeNull()

    expect(expectOk(await SdTicketApprovalRepository.cancel(live.id))).toBe(
      true,
    )
    expect(expectOk(await SdTicketApprovalRepository.cancel(live.id))).toBe(
      false,
    )
  })

  it('responds once and cancels the other pending requests of the ticket', async () => {
    const { workspace, user, ticket, other } = await setup()
    const target = await seedSdTicketApproval(workspace.id, ticket.id, user.id)
    const sibling = await seedSdTicketApproval(workspace.id, ticket.id, user.id)
    const answered = await seedSdTicketApproval(
      workspace.id,
      ticket.id,
      user.id,
      { status: 'REJECTED' },
    )
    const elsewhere = await seedSdTicketApproval(
      workspace.id,
      other.id,
      user.id,
    )
    const at = new Date()

    const result = expectOk(
      await SdTicketApprovalRepository.respond({
        id: target.id,
        ticketId: ticket.id,
        status: 'APPROVED',
        comment: 'ok',
        at,
      }),
    )
    expect(result).toEqual({ responded: true, canceledIds: [sibling.id] })
    const row = await prisma.sdTicketApproval.findUniqueOrThrow({
      where: { id: target.id },
    })
    expect(row.status).toBe('APPROVED')
    expect(row.comment).toBe('ok')
    expect(await statusOf(sibling.id)).toBe('CANCELED')
    expect(await statusOf(answered.id)).toBe('REJECTED')
    expect(await statusOf(elsewhere.id)).toBe('PENDING')

    expect(
      expectOk(
        await SdTicketApprovalRepository.respond({
          id: target.id,
          ticketId: ticket.id,
          status: 'REJECTED',
          comment: null,
          at,
        }),
      ),
    ).toEqual({ responded: false, canceledIds: [] })
  })

  it('does not respond past the expiry nor cancel when alone', async () => {
    const { workspace, user, ticket } = await setup()
    const expired = await seedSdTicketApproval(
      workspace.id,
      ticket.id,
      user.id,
      {
        expiresAt: new Date(Date.now() - 1000),
      },
    )
    expect(
      expectOk(
        await SdTicketApprovalRepository.respond({
          id: expired.id,
          ticketId: ticket.id,
          status: 'APPROVED',
          comment: null,
          at: new Date(),
        }),
      ).responded,
    ).toBe(false)
    const alone = await seedSdTicketApproval(workspace.id, ticket.id, user.id)
    await prisma.sdTicketApproval.update({
      where: { id: expired.id },
      data: { status: 'EXPIRED' },
    })
    expect(
      expectOk(
        await SdTicketApprovalRepository.respond({
          id: alone.id,
          ticketId: ticket.id,
          status: 'REJECTED',
          comment: null,
          at: new Date(),
        }),
      ),
    ).toEqual({ responded: true, canceledIds: [] })
  })

  it('maps failures to DATABASE_ERROR', async () => {
    const many = vi
      .spyOn(prisma.sdTicketApproval, 'findMany')
      .mockRejectedValueOnce(new Error('boom'))
    const first = vi
      .spyOn(prisma.sdTicketApproval, 'findFirst')
      .mockRejectedValueOnce(new Error('boom'))
    const unique = vi
      .spyOn(prisma.sdTicketApproval, 'findUnique')
      .mockRejectedValueOnce(new Error('boom'))
    const updateMany = vi
      .spyOn(prisma.sdTicketApproval, 'updateMany')
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'))
    const tx = vi
      .spyOn(prisma, '$transaction')
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'))
    expectErr(await SdTicketApprovalRepository.list('t'), 'DATABASE_ERROR')
    expectErr(
      await SdTicketApprovalRepository.findById('a', 't'),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdTicketApprovalRepository.findByTokenHash('h'),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdTicketApprovalRepository.markSent(['a'], new Date()),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdTicketApprovalRepository.expireOverdue({ id: 'a' }, new Date()),
      'DATABASE_ERROR',
    )
    expectErr(await SdTicketApprovalRepository.cancel('a'), 'DATABASE_ERROR')
    expectErr(await SdTicketApprovalRepository.createMany([]), 'DATABASE_ERROR')
    expectErr(
      await SdTicketApprovalRepository.respond({
        id: 'a',
        ticketId: 't',
        status: 'APPROVED',
        comment: null,
        at: new Date(),
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdTicketApprovalRepository.renewToken('missing', {
        tokenHash: 'x',
        expiresAt: new Date(),
      }),
      'DATABASE_ERROR',
    )
    for (const spy of [many, first, unique, updateMany, tx]) spy.mockRestore()
  })
})
