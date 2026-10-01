import { describe, expect, it, vi } from 'vitest'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import { seedSdPhase } from '@/src/__tests__/factories/sd-ticket-context.factory'
import {
  seedSdCatalogPart,
  seedSdTicketPart,
} from '@/src/__tests__/factories/sd-ticket-tabs.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdTicketPartRepository } from '../sd-ticket-part.repository'

async function setup() {
  const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
  const phase = await seedSdPhase(workspace.id)
  const ticket = await seedSdTicket(workspace.id, phase.id)
  const other = await seedSdTicket(workspace.id, phase.id)
  return { workspace, user, ticket, other }
}

const stockOf = async (id: string) =>
  (await prisma.sdPart.findUniqueOrThrow({ where: { id } })).stock

describe('SdTicketPartRepository', () => {
  it('creates with a stock decrement and lists/finds', async () => {
    const { workspace, user, ticket, other } = await setup()
    const catalog = await seedSdCatalogPart(workspace.id, { stock: 5 })
    const created = expectOk(
      await SdTicketPartRepository.create(
        {
          workspaceId: workspace.id,
          ticketId: ticket.id,
          createdById: user.id,
          partId: catalog.id,
          name: catalog.name,
          quantity: 2,
          status: 'INSTALLED',
        },
        { partId: catalog.id, workspaceId: workspace.id, delta: -2 },
      ),
    )
    expect(created.part?.stock).toBe(3)
    expect(await stockOf(catalog.id)).toBe(3)
    await seedSdTicketPart(workspace.id, other.id, user.id)

    const rows = expectOk(await SdTicketPartRepository.list(ticket.id))
    expect(rows.map((r) => r.id)).toEqual([created.id])
    expectErr(
      await SdTicketPartRepository.findById(created.id, other.id),
      'SD_TICKET_PART_NOT_FOUND',
    )
    expect(
      expectOk(await SdTicketPartRepository.findById(created.id, ticket.id))
        .createdBy.id,
    ).toBe(user.id)
  })

  it('refuses a decrement beyond the stock without writing anything', async () => {
    const { workspace, user, ticket } = await setup()
    const catalog = await seedSdCatalogPart(workspace.id, { stock: 1 })
    const untracked = await seedSdCatalogPart(workspace.id, { stock: null })
    expectErr(
      await SdTicketPartRepository.create(
        {
          workspaceId: workspace.id,
          ticketId: ticket.id,
          createdById: user.id,
          partId: catalog.id,
          name: 'x',
          quantity: 2,
        },
        { partId: catalog.id, workspaceId: workspace.id, delta: -2 },
      ),
      'SD_PART_OUT_OF_STOCK',
    )
    expectErr(
      await SdTicketPartRepository.create(
        {
          workspaceId: workspace.id,
          ticketId: ticket.id,
          createdById: user.id,
          partId: untracked.id,
          name: 'x',
        },
        { partId: untracked.id, workspaceId: workspace.id, delta: -1 },
      ),
      'SD_PART_OUT_OF_STOCK',
    )
    expect(await stockOf(catalog.id)).toBe(1)
    expect(await prisma.sdTicketPart.count()).toBe(0)
  })

  it('updates with increments, no-op adjustments, and deletes', async () => {
    const { workspace, user, ticket } = await setup()
    const catalog = await seedSdCatalogPart(workspace.id, { stock: 3 })
    const row = await seedSdTicketPart(workspace.id, ticket.id, user.id, {
      partId: catalog.id,
      quantity: 2,
      status: 'INSTALLED',
    })
    const returned = expectOk(
      await SdTicketPartRepository.update(
        row.id,
        { status: 'RETURNED' },
        { partId: catalog.id, workspaceId: workspace.id, delta: 2 },
      ),
    )
    expect(returned.status).toBe('RETURNED')
    expect(await stockOf(catalog.id)).toBe(5)

    const noted = expectOk(
      await SdTicketPartRepository.update(
        row.id,
        { notes: 'ok' },
        { partId: catalog.id, workspaceId: workspace.id, delta: 0 },
      ),
    )
    expect(noted.notes).toBe('ok')
    expectOk(await SdTicketPartRepository.update(row.id, { sku: 'S' }, null))
    expect(await stockOf(catalog.id)).toBe(5)

    expectOk(
      await SdTicketPartRepository.delete(row.id, {
        partId: catalog.id,
        workspaceId: workspace.id,
        delta: 1,
      }),
    )
    expect(await stockOf(catalog.id)).toBe(6)
    expectErr(
      await SdTicketPartRepository.findById(row.id, ticket.id),
      'SD_TICKET_PART_NOT_FOUND',
    )
  })

  it('keeps the row when the stock update fails on update/delete', async () => {
    const { workspace, user, ticket } = await setup()
    const catalog = await seedSdCatalogPart(workspace.id, { stock: 0 })
    const row = await seedSdTicketPart(workspace.id, ticket.id, user.id, {
      partId: catalog.id,
    })
    const stock = { partId: catalog.id, workspaceId: workspace.id, delta: -1 }
    expectErr(
      await SdTicketPartRepository.update(
        row.id,
        { status: 'INSTALLED' },
        stock,
      ),
      'SD_PART_OUT_OF_STOCK',
    )
    expectErr(
      await SdTicketPartRepository.delete(row.id, stock),
      'SD_PART_OUT_OF_STOCK',
    )
    const still = await prisma.sdTicketPart.findUniqueOrThrow({
      where: { id: row.id },
    })
    expect(still.status).toBe('REQUESTED')
  })

  it('maps failures to DATABASE_ERROR', async () => {
    const many = vi
      .spyOn(prisma.sdTicketPart, 'findMany')
      .mockRejectedValueOnce(new Error('boom'))
    const first = vi
      .spyOn(prisma.sdTicketPart, 'findFirst')
      .mockRejectedValueOnce(new Error('boom'))
    expectErr(await SdTicketPartRepository.list('t'), 'DATABASE_ERROR')
    expectErr(await SdTicketPartRepository.findById('a', 't'), 'DATABASE_ERROR')
    expectErr(
      await SdTicketPartRepository.create(
        {
          workspaceId: 'missing',
          ticketId: 'missing',
          createdById: 'missing',
          partId: null,
          name: 'x',
        },
        null,
      ),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdTicketPartRepository.update('missing', { name: 'x' }, null),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdTicketPartRepository.delete('missing', null),
      'DATABASE_ERROR',
    )
    many.mockRestore()
    first.mockRestore()
  })
})
