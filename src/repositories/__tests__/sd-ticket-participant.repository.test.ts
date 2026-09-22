import { describe, expect, it, vi } from 'vitest'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import { seedSdPhase } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdTicketParticipantRepository } from '../sd-ticket-participant.repository'

describe('SdTicketParticipantRepository', () => {
  it('adds idempotently and removes', async () => {
    const [workspace, user, adder] = await Promise.all([
      seedWorkspace(),
      seedUser(),
      seedUser(),
    ])
    const phase = await seedSdPhase(workspace.id)
    const ticket = await seedSdTicket(workspace.id, phase.id)

    expect(
      expectOk(
        await SdTicketParticipantRepository.add(ticket.id, user.id, adder.id),
      ),
    ).toBe(true)
    expect(
      expectOk(
        await SdTicketParticipantRepository.add(ticket.id, user.id, null),
      ),
    ).toBe(false)
    const row = await prisma.sdTicketParticipant.findFirstOrThrow({
      where: { ticketId: ticket.id },
    })
    expect(row.addedById).toBe(adder.id)

    expect(
      expectOk(await SdTicketParticipantRepository.remove(ticket.id, user.id)),
    ).toBe(true)
    expect(
      expectOk(await SdTicketParticipantRepository.remove(ticket.id, user.id)),
    ).toBe(false)
  })

  it('maps failures to DATABASE_ERROR', async () => {
    const add = vi
      .spyOn(prisma.sdTicketParticipant, 'createMany')
      .mockRejectedValueOnce(new Error('boom'))
    const remove = vi
      .spyOn(prisma.sdTicketParticipant, 'deleteMany')
      .mockRejectedValueOnce(new Error('boom'))
    expectErr(
      await SdTicketParticipantRepository.add('t', 'u', null),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdTicketParticipantRepository.remove('t', 'u'),
      'DATABASE_ERROR',
    )
    add.mockRestore()
    remove.mockRestore()
  })
})
