import { describe, expect, it, vi } from 'vitest'
import {
  seedSdKbArticle,
  seedSdTicket,
} from '@/src/__tests__/factories/sd-kb.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdKbTicketLinkRepository } from '../sd-kb-ticket-link.repository'

describe('SdKbTicketLinkRepository', () => {
  describe('findTicket()', () => {
    it('returns the ticket with its participant ids', async () => {
      const [ws, user] = await Promise.all([seedWorkspace(), seedUser()])
      const ticket = await seedSdTicket(ws.id, { requesterId: user.id })
      await prisma.sdTicketParticipant.create({
        data: { ticketId: ticket.id, userId: user.id },
      })

      const found = expectOk(
        await SdKbTicketLinkRepository.findTicket(ticket.id, ws.id),
      )
      expect(found).toMatchObject({
        id: ticket.id,
        title: ticket.title,
        requesterId: user.id,
        participantIds: [user.id],
      })
    })

    it('hides deleted and cross-workspace tickets', async () => {
      const [a, b] = await Promise.all([seedWorkspace(), seedWorkspace()])
      const deleted = await seedSdTicket(a.id, { deletedAt: new Date() })
      const other = await seedSdTicket(b.id)
      expectErr(
        await SdKbTicketLinkRepository.findTicket(deleted.id, a.id),
        'SD_TICKET_NOT_FOUND',
      )
      expectErr(
        await SdKbTicketLinkRepository.findTicket(other.id, a.id),
        'SD_TICKET_NOT_FOUND',
      )
    })
  })

  it('links idempotently, lists live articles and unlinks', async () => {
    const [ws, user] = await Promise.all([seedWorkspace(), seedUser()])
    const ticket = await seedSdTicket(ws.id)
    const published = await seedSdKbArticle(ws.id, {
      status: 'PUBLISHED',
      visibility: 'PORTAL',
    })
    const internal = await seedSdKbArticle(ws.id)
    const archived = await seedSdKbArticle(ws.id, { archivedAt: new Date() })

    const first = expectOk(
      await SdKbTicketLinkRepository.link({
        ticketId: ticket.id,
        articleId: published.id,
        linkedById: user.id,
      }),
    )
    expect(first.article.id).toBe(published.id)
    const again = expectOk(
      await SdKbTicketLinkRepository.link({
        ticketId: ticket.id,
        articleId: published.id,
        linkedById: user.id,
      }),
    )
    expect(again.createdAt).toEqual(first.createdAt)
    for (const article of [internal, archived]) {
      expectOk(
        await SdKbTicketLinkRepository.link({
          ticketId: ticket.id,
          articleId: article.id,
          linkedById: user.id,
        }),
      )
    }

    const agentView = expectOk(
      await SdKbTicketLinkRepository.listByTicket(ticket.id, {
        portalOnly: false,
      }),
    )
    expect(agentView.map((l) => l.article.id)).toEqual([
      published.id,
      internal.id,
    ])
    const portalView = expectOk(
      await SdKbTicketLinkRepository.listByTicket(ticket.id, {
        portalOnly: true,
      }),
    )
    expect(portalView.map((l) => l.article.id)).toEqual([published.id])

    expectOk(await SdKbTicketLinkRepository.unlink(ticket.id, published.id))
    expectOk(await SdKbTicketLinkRepository.unlink(ticket.id, published.id))
    expect(
      await prisma.sdTicketKbLink.count({ where: { ticketId: ticket.id } }),
    ).toBe(2)
  })

  it('maps Prisma failures to DATABASE_ERROR', async () => {
    const boom = () => Promise.reject(new Error('boom'))
    const spies = [
      vi.spyOn(prisma.sdTicket, 'findFirst').mockImplementation(boom as never),
      vi
        .spyOn(prisma.sdTicketKbLink, 'findMany')
        .mockImplementation(boom as never),
      vi
        .spyOn(prisma.sdTicketKbLink, 'upsert')
        .mockImplementation(boom as never),
      vi
        .spyOn(prisma.sdTicketKbLink, 'deleteMany')
        .mockImplementation(boom as never),
    ]
    expectErr(
      await SdKbTicketLinkRepository.findTicket('t', 'w'),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdKbTicketLinkRepository.listByTicket('t', { portalOnly: false }),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdKbTicketLinkRepository.link({
        ticketId: 't',
        articleId: 'a',
        linkedById: 'u',
      }),
      'DATABASE_ERROR',
    )
    expectErr(await SdKbTicketLinkRepository.unlink('t', 'a'), 'DATABASE_ERROR')
    for (const spy of spies) spy.mockRestore()
  })
})
