import { describe, expect, it, vi } from 'vitest'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import { seedSdPhase } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { seedSdTicketCost } from '@/src/__tests__/factories/sd-ticket-tabs.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdTicketCostRepository } from '../sd-ticket-cost.repository'

async function setup() {
  const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
  const phase = await seedSdPhase(workspace.id)
  const ticket = await seedSdTicket(workspace.id, phase.id)
  const other = await seedSdTicket(workspace.id, phase.id)
  return { workspace, user, ticket, other }
}

describe('SdTicketCostRepository', () => {
  it('creates, lists newest incurred first, updates and deletes', async () => {
    const { workspace, user, ticket, other } = await setup()
    const created = expectOk(
      await SdTicketCostRepository.create({
        workspaceId: workspace.id,
        ticketId: ticket.id,
        createdById: user.id,
        description: 'Hora técnica',
        quantity: '1.50',
        unitCost: '10.33',
        category: 'LABOR',
        billable: true,
        userId: user.id,
        incurredAt: new Date('2026-09-20T10:00:00.000Z'),
      }),
    )
    expect(created.quantity.toFixed(2)).toBe('1.50')
    expect(created.user?.id).toBe(user.id)
    await seedSdTicketCost(workspace.id, ticket.id, user.id, {
      description: 'Recente',
      incurredAt: new Date('2026-09-21T10:00:00.000Z'),
    })
    await seedSdTicketCost(workspace.id, other.id, user.id)

    const rows = expectOk(await SdTicketCostRepository.list(ticket.id))
    expect(rows.map((r) => r.description)).toEqual(['Recente', 'Hora técnica'])

    expectErr(
      await SdTicketCostRepository.findById(created.id, other.id),
      'SD_COST_NOT_FOUND',
    )
    const updated = expectOk(
      await SdTicketCostRepository.update(created.id, {
        unitCost: '20.00',
        billable: false,
      }),
    )
    expect(updated.unitCost.toFixed(2)).toBe('20.00')
    expect(updated.billable).toBe(false)
    expect(
      expectOk(await SdTicketCostRepository.findById(created.id, ticket.id))
        .billable,
    ).toBe(false)

    expectOk(await SdTicketCostRepository.delete(created.id))
    expectErr(
      await SdTicketCostRepository.findById(created.id, ticket.id),
      'SD_COST_NOT_FOUND',
    )
  })

  it('maps failures to DATABASE_ERROR', async () => {
    const many = vi
      .spyOn(prisma.sdTicketCost, 'findMany')
      .mockRejectedValueOnce(new Error('boom'))
    const first = vi
      .spyOn(prisma.sdTicketCost, 'findFirst')
      .mockRejectedValueOnce(new Error('boom'))
    expectErr(await SdTicketCostRepository.list('t'), 'DATABASE_ERROR')
    expectErr(await SdTicketCostRepository.findById('a', 't'), 'DATABASE_ERROR')
    expectErr(
      await SdTicketCostRepository.create({
        workspaceId: 'missing',
        ticketId: 'missing',
        createdById: 'missing',
        description: 'x',
        unitCost: '1.00',
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdTicketCostRepository.update('missing', { description: 'x' }),
      'DATABASE_ERROR',
    )
    expectErr(await SdTicketCostRepository.delete('missing'), 'DATABASE_ERROR')
    many.mockRestore()
    first.mockRestore()
  })
})
