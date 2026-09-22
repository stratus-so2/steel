import { describe, expect, it, vi } from 'vitest'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import { seedSdPhase } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdTicketEventRepository } from '../sd-ticket-event.repository'

describe('SdTicketEventRepository', () => {
  it('records events and lists them newest first with a cursor', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const phase = await seedSdPhase(workspace.id)
    const ticket = await seedSdTicket(workspace.id, phase.id)
    expect(expectOk(await SdTicketEventRepository.createMany([]))).toBe(0)

    const count = expectOk(
      await SdTicketEventRepository.createMany([
        {
          workspaceId: workspace.id,
          ticketId: ticket.id,
          actorKind: 'AGENT',
          actorUserId: user.id,
          action: 'ticket.created',
        },
        {
          workspaceId: workspace.id,
          ticketId: ticket.id,
          actorKind: 'SYSTEM',
          action: 'field.changed',
          field: 'priorityId',
          fromValue: null,
          toValue: { id: 'p', label: 'P1' },
          meta: { label: 'Prioridade' },
        },
      ]),
    )
    expect(count).toBe(2)
    await prisma.sdTicketEvent.updateMany({
      where: { action: 'field.changed' },
      data: { createdAt: new Date('2030-01-01') },
    })

    const page = expectOk(
      await SdTicketEventRepository.listByTicket(ticket.id, { limit: 1 }),
    )
    expect(page.items[0]).toMatchObject({
      action: 'field.changed',
      toValue: { id: 'p', label: 'P1' },
      fromValue: null,
      actor: null,
    })
    expect(page.nextCursor).toBe(page.items[0].id)

    const next = expectOk(
      await SdTicketEventRepository.listByTicket(ticket.id, {
        limit: 1,
        cursor: page.nextCursor as string,
      }),
    )
    expect(next.items[0].action).toBe('ticket.created')
    expect(next.items[0].actor?.id).toBe(user.id)
    expect(next.nextCursor).toBeNull()
  })

  it('maps failures to DATABASE_ERROR', async () => {
    const create = vi
      .spyOn(prisma.sdTicketEvent, 'createMany')
      .mockRejectedValueOnce(new Error('boom'))
    const list = vi
      .spyOn(prisma.sdTicketEvent, 'findMany')
      .mockRejectedValueOnce(new Error('boom'))
    expectErr(
      await SdTicketEventRepository.createMany([
        { workspaceId: 'w', ticketId: 't', actorKind: 'SYSTEM', action: 'x' },
      ]),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdTicketEventRepository.listByTicket('t', { limit: 1 }),
      'DATABASE_ERROR',
    )
    create.mockRestore()
    list.mockRestore()
  })
})
