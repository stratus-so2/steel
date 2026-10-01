import { describe, expect, it, vi } from 'vitest'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import { seedSdPhaseFlow } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdTicketCsatRepository } from '../sd-ticket-csat.repository'

async function setup() {
  const workspace = await seedWorkspace()
  const flow = await seedSdPhaseFlow(workspace.id)
  const ticket = await seedSdTicket(workspace.id, flow.resolved.id)
  return { workspace, ticket }
}

describe('SdTicketCsatRepository.submit()', () => {
  it('writes the rating only once', async () => {
    const { workspace, ticket } = await setup()
    expect(
      expectOk(
        await SdTicketCsatRepository.submit(ticket.id, workspace.id, 4, 'Bom'),
      ),
    ).toBe(true)
    expect(
      expectOk(
        await SdTicketCsatRepository.submit(ticket.id, workspace.id, 1, null),
      ),
    ).toBe(false)
    const row = await prisma.sdTicket.findUniqueOrThrow({
      where: { id: ticket.id },
    })
    expect(row.csatScore).toBe(4)
    expect(row.csatComment).toBe('Bom')
  })

  it('ignores tickets of another workspace or deleted ones', async () => {
    const { ticket } = await setup()
    const other = await seedWorkspace()
    expect(
      expectOk(
        await SdTicketCsatRepository.submit(ticket.id, other.id, 5, null),
      ),
    ).toBe(false)
    await prisma.sdTicket.update({
      where: { id: ticket.id },
      data: { deletedAt: new Date() },
    })
    expect(
      expectOk(
        await SdTicketCsatRepository.submit(
          ticket.id,
          ticket.workspaceId,
          5,
          null,
        ),
      ),
    ).toBe(false)
  })

  it('maps Prisma failures to DATABASE_ERROR', async () => {
    vi.spyOn(prisma.sdTicket, 'updateMany').mockRejectedValueOnce(
      new Error('boom'),
    )
    expectErr(
      await SdTicketCsatRepository.submit('t', 'ws', 5, null),
      'DATABASE_ERROR',
    )
  })
})
