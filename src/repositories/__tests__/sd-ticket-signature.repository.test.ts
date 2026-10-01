import { createId } from '@paralleldrive/cuid2'
import { describe, expect, it, vi } from 'vitest'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import { seedSdPhase } from '@/src/__tests__/factories/sd-ticket-context.factory'
import {
  seedSdTicketCost,
  seedSdTicketPart,
  seedSdTicketSignature,
} from '@/src/__tests__/factories/sd-ticket-tabs.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdTicketSignatureRepository } from '../sd-ticket-signature.repository'

async function setup() {
  const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
  const phase = await seedSdPhase(workspace.id)
  const ticket = await seedSdTicket(workspace.id, phase.id)
  const other = await seedSdTicket(workspace.id, phase.id)
  return { workspace, user, ticket, other }
}

describe('SdTicketSignatureRepository', () => {
  it('creates, lists newest first and finds within the ticket', async () => {
    const { workspace, user, ticket, other } = await setup()
    const id = createId()
    const created = expectOk(
      await SdTicketSignatureRepository.create({
        id,
        workspaceId: workspace.id,
        ticketId: ticket.id,
        purpose: 'Aceite',
        signerName: 'Maria',
        signerDocument: '123',
        signerEmail: null,
        signedById: user.id,
        storageKey: 'k',
        imageSha256: 'a',
        ticketSha256: 'b',
        signedAt: new Date('2026-09-20T12:00:00.000Z'),
      }),
    )
    expect(created.signedBy?.id).toBe(user.id)
    const newer = await seedSdTicketSignature(workspace.id, ticket.id, {
      signedAt: new Date('2026-09-21T12:00:00.000Z'),
    })
    await seedSdTicketSignature(workspace.id, other.id)

    const rows = expectOk(await SdTicketSignatureRepository.list(ticket.id))
    expect(rows.map((r) => r.id)).toEqual([newer.id, id])
    expect(
      expectOk(await SdTicketSignatureRepository.findById(id, ticket.id)).id,
    ).toBe(id)
    expectErr(
      await SdTicketSignatureRepository.findById(id, other.id),
      'SD_SIGNATURE_NOT_FOUND',
    )
  })

  it('totals costs and active parts with exact decimals', async () => {
    const { workspace, user, ticket, other } = await setup()
    expect(
      expectOk(await SdTicketSignatureRepository.ticketTotals(ticket.id)),
    ).toEqual({ costs: '0.00', parts: '0.00' })

    await seedSdTicketCost(workspace.id, ticket.id, user.id, {
      quantity: '1.50',
      unitCost: '10.33',
    })
    await seedSdTicketCost(workspace.id, ticket.id, user.id, {
      quantity: '2',
      unitCost: '0.10',
    })
    await seedSdTicketCost(workspace.id, other.id, user.id, {
      unitCost: '999.00',
    })
    await seedSdTicketPart(workspace.id, ticket.id, user.id, {
      quantity: 3,
      unitCost: '19.99',
      status: 'INSTALLED',
    })
    await seedSdTicketPart(workspace.id, ticket.id, user.id, {
      unitCost: '100.00',
      status: 'CANCELED',
    })
    await seedSdTicketPart(workspace.id, ticket.id, user.id, {
      unitCost: '100.00',
      status: 'RETURNED',
    })

    // 1.5 × 10.33 = 15.495 → 15.50; + 0.20
    expect(
      expectOk(await SdTicketSignatureRepository.ticketTotals(ticket.id)),
    ).toEqual({ costs: '15.70', parts: '59.97' })
  })

  it('maps failures to DATABASE_ERROR', async () => {
    const many = vi
      .spyOn(prisma.sdTicketSignature, 'findMany')
      .mockRejectedValueOnce(new Error('boom'))
    const first = vi
      .spyOn(prisma.sdTicketSignature, 'findFirst')
      .mockRejectedValueOnce(new Error('boom'))
    const costs = vi
      .spyOn(prisma.sdTicketCost, 'findMany')
      .mockRejectedValueOnce(new Error('boom'))
    expectErr(await SdTicketSignatureRepository.list('t'), 'DATABASE_ERROR')
    expectErr(
      await SdTicketSignatureRepository.findById('a', 't'),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdTicketSignatureRepository.ticketTotals('t'),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdTicketSignatureRepository.create({
        id: 'x',
        workspaceId: 'missing',
        ticketId: 'missing',
        purpose: 'p',
        signerName: 'n',
        signerDocument: null,
        signerEmail: null,
        signedById: 'missing',
        storageKey: 'k',
        imageSha256: 'a',
        ticketSha256: 'b',
        signedAt: new Date(),
      }),
      'DATABASE_ERROR',
    )
    many.mockRestore()
    first.mockRestore()
    costs.mockRestore()
  })
})
