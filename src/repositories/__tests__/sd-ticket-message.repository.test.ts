import { describe, expect, it, vi } from 'vitest'
import { seedMembership } from '@/src/__tests__/factories/membership.factory'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import {
  seedSdDepartment,
  seedSdDepartmentMember,
  seedSdPhase,
} from '@/src/__tests__/factories/sd-ticket-context.factory'
import {
  seedSdTicketAttachment,
  seedSdTicketMessage,
} from '@/src/__tests__/factories/sd-ticket-tabs.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdTicketMessageRepository } from '../sd-ticket-message.repository'

async function setup() {
  const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
  const phase = await seedSdPhase(workspace.id)
  const ticket = await seedSdTicket(workspace.id, phase.id)
  const other = await seedSdTicket(workspace.id, phase.id)
  return { workspace, user, ticket, other }
}

const at = (minutes: number) => new Date(Date.UTC(2026, 8, 21, 12, minutes, 0))

describe('SdTicketMessageRepository.list', () => {
  it('pages from newest to oldest with a cursor and hides internal/deleted', async () => {
    const { workspace, ticket, other } = await setup()
    const ids: string[] = []
    for (let i = 0; i < 5; i++) {
      const m = await seedSdTicketMessage(workspace.id, ticket.id, {
        body: `m${i}`,
        createdAt: at(i),
        visibility: i === 3 ? 'INTERNAL' : 'PUBLIC',
        deletedAt: i === 4 ? at(10) : null,
      })
      ids.push(m.id)
    }
    await seedSdTicketMessage(workspace.id, other.id, { createdAt: at(1) })

    const first = expectOk(
      await SdTicketMessageRepository.list({
        ticketId: ticket.id,
        includeInternal: true,
        limit: 2,
      }),
    )
    expect(first.items.map((m) => m.body)).toEqual(['m3', 'm2'])
    expect(first.hasMore).toBe(true)

    const second = expectOk(
      await SdTicketMessageRepository.list({
        ticketId: ticket.id,
        includeInternal: true,
        before: first.items[1]?.id,
        limit: 2,
      }),
    )
    expect(second.items.map((m) => m.body)).toEqual(['m1', 'm0'])
    expect(second.hasMore).toBe(false)

    const publicOnly = expectOk(
      await SdTicketMessageRepository.list({
        ticketId: ticket.id,
        includeInternal: false,
        limit: 10,
      }),
    )
    expect(publicOnly.items.map((m) => m.body)).toEqual(['m2', 'm1', 'm0'])
  })

  it('maps failures to DATABASE_ERROR', async () => {
    const spy = vi
      .spyOn(prisma.sdTicketMessage, 'findMany')
      .mockRejectedValueOnce(new Error('boom'))
    expectErr(
      await SdTicketMessageRepository.list({
        ticketId: 't',
        includeInternal: true,
        limit: 1,
      }),
      'DATABASE_ERROR',
    )
    spy.mockRestore()
  })
})

describe('SdTicketMessageRepository.findById', () => {
  it('finds within the ticket, ignoring deleted and other tickets', async () => {
    const { workspace, ticket, other } = await setup()
    const m = await seedSdTicketMessage(workspace.id, ticket.id)
    const gone = await seedSdTicketMessage(workspace.id, ticket.id, {
      deletedAt: new Date(),
    })
    expect(
      expectOk(await SdTicketMessageRepository.findById(m.id, ticket.id)).id,
    ).toBe(m.id)
    expectErr(
      await SdTicketMessageRepository.findById(m.id, other.id),
      'SD_MESSAGE_NOT_FOUND',
    )
    expectErr(
      await SdTicketMessageRepository.findById(gone.id, ticket.id),
      'SD_MESSAGE_NOT_FOUND',
    )
    const spy = vi
      .spyOn(prisma.sdTicketMessage, 'findFirst')
      .mockRejectedValueOnce(new Error('boom'))
    expectErr(
      await SdTicketMessageRepository.findById('x', 'y'),
      'DATABASE_ERROR',
    )
    spy.mockRestore()
  })
})

describe('SdTicketMessageRepository.create', () => {
  it('creates and attaches only unattached attachments of the ticket', async () => {
    const { workspace, user, ticket, other } = await setup()
    const free = await seedSdTicketAttachment(workspace.id, ticket.id, {
      uploadedById: user.id,
    })
    const foreign = await seedSdTicketAttachment(workspace.id, other.id)
    const prior = await seedSdTicketMessage(workspace.id, ticket.id)
    const taken = await seedSdTicketAttachment(workspace.id, ticket.id, {
      messageId: prior.id,
    })

    const created = expectOk(
      await SdTicketMessageRepository.create({
        workspaceId: workspace.id,
        ticketId: ticket.id,
        authorKind: 'AGENT',
        authorUserId: user.id,
        visibility: 'INTERNAL',
        body: 'Nota',
        attachmentIds: [free.id, foreign.id, taken.id],
      }),
    )
    expect(created.visibility).toBe('INTERNAL')
    expect(created.authorUser?.id).toBe(user.id)
    expect(created.attachments.map((a) => a.id)).toEqual([free.id])
    const stillForeign = await prisma.sdTicketAttachment.findUniqueOrThrow({
      where: { id: foreign.id },
    })
    expect(stillForeign.messageId).toBeNull()
    const stillTaken = await prisma.sdTicketAttachment.findUniqueOrThrow({
      where: { id: taken.id },
    })
    expect(stillTaken.messageId).toBe(prior.id)
  })

  it('creates without attachments', async () => {
    const { workspace, ticket } = await setup()
    const created = expectOk(
      await SdTicketMessageRepository.create({
        workspaceId: workspace.id,
        ticketId: ticket.id,
        authorKind: 'REQUESTER',
        authorUserId: null,
        visibility: 'PUBLIC',
        body: 'Oi',
        attachmentIds: [],
      }),
    )
    expect(created.attachments).toEqual([])
  })

  it('maps failures to DATABASE_ERROR', async () => {
    const spy = vi
      .spyOn(prisma, '$transaction')
      .mockRejectedValueOnce(new Error('boom'))
    expectErr(
      await SdTicketMessageRepository.create({
        workspaceId: 'w',
        ticketId: 't',
        authorKind: 'AGENT',
        authorUserId: null,
        visibility: 'PUBLIC',
        body: 'x',
        attachmentIds: [],
      }),
      'DATABASE_ERROR',
    )
    spy.mockRestore()
  })
})

describe('SdTicketMessageRepository.updateBody / softDelete', () => {
  it('edits the body and soft-deletes with the attachments', async () => {
    const { workspace, ticket } = await setup()
    const m = await seedSdTicketMessage(workspace.id, ticket.id)
    const a = await seedSdTicketAttachment(workspace.id, ticket.id, {
      messageId: m.id,
    })
    const editedAt = new Date('2026-09-21T13:00:00.000Z')
    const updated = expectOk(
      await SdTicketMessageRepository.updateBody(m.id, 'Novo', editedAt),
    )
    expect(updated.body).toBe('Novo')
    expect(updated.editedAt?.toISOString()).toBe(editedAt.toISOString())

    expectOk(await SdTicketMessageRepository.softDelete(m.id, editedAt))
    const row = await prisma.sdTicketMessage.findUniqueOrThrow({
      where: { id: m.id },
    })
    expect(row.deletedAt).not.toBeNull()
    const att = await prisma.sdTicketAttachment.findUniqueOrThrow({
      where: { id: a.id },
    })
    expect(att.deletedAt).not.toBeNull()
  })

  it('maps failures to DATABASE_ERROR', async () => {
    expectErr(
      await SdTicketMessageRepository.updateBody('missing', 'x', new Date()),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdTicketMessageRepository.softDelete('missing', new Date()),
      'DATABASE_ERROR',
    )
  })
})

describe('SdTicketMessageRepository.filterAgentIds', () => {
  it('keeps department members of active departments and OWNER/ADMIN', async () => {
    const { workspace } = await setup()
    const [agent, admin, member, inactiveAgent, outsider] = await Promise.all([
      seedUser(),
      seedUser(),
      seedUser(),
      seedUser(),
      seedUser(),
    ])
    const dept = await seedSdDepartment(workspace.id)
    const off = await seedSdDepartment(workspace.id, {
      name: 'Inativo',
      active: false,
    })
    await seedSdDepartmentMember(dept.id, agent.id)
    await seedSdDepartmentMember(off.id, inactiveAgent.id)
    await seedMembership({
      userId: admin.id,
      workspaceId: workspace.id,
      role: 'ADMIN',
    })
    await seedMembership({ userId: member.id, workspaceId: workspace.id })

    const ids = expectOk(
      await SdTicketMessageRepository.filterAgentIds(workspace.id, [
        agent.id,
        admin.id,
        member.id,
        inactiveAgent.id,
        outsider.id,
        agent.id,
      ]),
    )
    expect(ids.sort()).toEqual([agent.id, admin.id].sort())
    expect(
      expectOk(
        await SdTicketMessageRepository.filterAgentIds(workspace.id, []),
      ),
    ).toEqual([])
  })

  it('maps failures to DATABASE_ERROR', async () => {
    const spy = vi
      .spyOn(prisma.sdDepartmentMember, 'findMany')
      .mockRejectedValueOnce(new Error('boom'))
    expectErr(
      await SdTicketMessageRepository.filterAgentIds('w', ['u']),
      'DATABASE_ERROR',
    )
    spy.mockRestore()
  })
})
