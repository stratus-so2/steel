import { describe, expect, it, vi } from 'vitest'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import { seedSdPhase } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { seedSdTicketTask } from '@/src/__tests__/factories/sd-ticket-tabs.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdTicketTaskRepository } from '../sd-ticket-task.repository'

async function setup() {
  const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
  const phase = await seedSdPhase(workspace.id)
  const ticket = await seedSdTicket(workspace.id, phase.id)
  const other = await seedSdTicket(workspace.id, phase.id)
  return { workspace, user, ticket, other }
}

describe('SdTicketTaskRepository', () => {
  it('creates at the end of the list and finds/updates/deletes', async () => {
    const { workspace, user, ticket, other } = await setup()
    const first = expectOk(
      await SdTicketTaskRepository.create({
        workspaceId: workspace.id,
        ticketId: ticket.id,
        createdById: user.id,
        title: 'A',
        assigneeId: user.id,
      }),
    )
    expect(first.position).toBe(0)
    expect(first.assignee?.id).toBe(user.id)
    expect(first.createdBy.id).toBe(user.id)
    await seedSdTicketTask(workspace.id, ticket.id, user.id, { position: 7 })
    const next = expectOk(
      await SdTicketTaskRepository.create({
        workspaceId: workspace.id,
        ticketId: ticket.id,
        createdById: user.id,
        title: 'C',
      }),
    )
    expect(next.position).toBe(8)

    expect(
      expectOk(await SdTicketTaskRepository.findById(first.id, ticket.id)).id,
    ).toBe(first.id)
    expectErr(
      await SdTicketTaskRepository.findById(first.id, other.id),
      'SD_TASK_NOT_FOUND',
    )

    const done = expectOk(
      await SdTicketTaskRepository.update(first.id, {
        status: 'DONE',
        completedAt: new Date(),
      }),
    )
    expect(done.status).toBe('DONE')

    expectOk(await SdTicketTaskRepository.delete(first.id))
    expectErr(
      await SdTicketTaskRepository.findById(first.id, ticket.id),
      'SD_TASK_NOT_FOUND',
    )
  })

  it('lists by position and reorders only the ticket tasks', async () => {
    const { workspace, user, ticket, other } = await setup()
    const a = await seedSdTicketTask(workspace.id, ticket.id, user.id, {
      title: 'a',
      position: 0,
    })
    const b = await seedSdTicketTask(workspace.id, ticket.id, user.id, {
      title: 'b',
      position: 1,
    })
    const foreign = await seedSdTicketTask(workspace.id, other.id, user.id, {
      position: 5,
    })
    expectOk(
      await SdTicketTaskRepository.reorder(ticket.id, [b.id, a.id, foreign.id]),
    )
    const rows = expectOk(await SdTicketTaskRepository.list(ticket.id))
    expect(rows.map((r) => r.title)).toEqual(['b', 'a'])
    const untouched = await prisma.sdTicketTask.findUniqueOrThrow({
      where: { id: foreign.id },
    })
    expect(untouched.position).toBe(5)
  })

  it('lists the tasks owing a due-date notice and claims each one once', async () => {
    const { workspace, user, ticket } = await setup()
    const now = new Date('2026-10-06T12:00:00.000Z')
    const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000)
    const seed = (title: string, data = {}) =>
      seedSdTicketTask(workspace.id, ticket.id, user.id, {
        title,
        assigneeId: user.id,
        ...data,
      })

    const soon = await seed('soon', { dueDate: at(30) })
    const overdue = await seed('overdue', { dueDate: at(-30) })
    await seed('far', { dueDate: at(180) })
    await seed('ancient', { dueDate: at(-60 * 48) })
    await seed('done', { dueDate: at(10), status: 'DONE' })
    await seed('unassigned', { dueDate: at(10), assigneeId: null })
    await seed('warned', { dueDate: at(10), dueSoonNotifiedAt: now })
    await seed('late-warned', { dueDate: at(-10), overdueNotifiedAt: now })
    const params = {
      workspaceIds: [workspace.id],
      now,
      soonUntil: at(60),
      overdueFrom: at(-60 * 24),
      limit: 50,
    }

    const rows = expectOk(await SdTicketTaskRepository.listDueReminders(params))
    expect(rows.map((row) => row.title)).toEqual(['overdue', 'soon'])
    expect(rows[0].ticket).toMatchObject({
      id: ticket.id,
      number: ticket.number,
      participants: [],
      contact: null,
    })
    expect(
      expectOk(
        await SdTicketTaskRepository.listDueReminders({
          ...params,
          workspaceIds: [],
        }),
      ),
    ).toEqual([])

    expect(
      expectOk(
        await SdTicketTaskRepository.claimReminder(soon.id, 'due_soon', now),
      ),
    ).toBe(true)
    expect(
      expectOk(
        await SdTicketTaskRepository.claimReminder(soon.id, 'due_soon', now),
      ),
    ).toBe(false)
    expect(
      expectOk(
        await SdTicketTaskRepository.claimReminder(overdue.id, 'overdue', now),
      ),
    ).toBe(true)
    expect(
      expectOk(await SdTicketTaskRepository.listDueReminders(params)),
    ).toEqual([])

    // Trashed tickets are skipped.
    await prisma.sdTicketTask.updateMany({
      where: { id: soon.id },
      data: { dueSoonNotifiedAt: null },
    })
    await prisma.sdTicket.update({
      where: { id: ticket.id },
      data: { deletedAt: now },
    })
    expect(
      expectOk(await SdTicketTaskRepository.listDueReminders(params)),
    ).toEqual([])
  })

  it('maps failures to DATABASE_ERROR', async () => {
    const many = vi
      .spyOn(prisma.sdTicketTask, 'findMany')
      .mockRejectedValueOnce(new Error('boom'))
    const first = vi
      .spyOn(prisma.sdTicketTask, 'findFirst')
      .mockRejectedValueOnce(new Error('boom'))
    const tx = vi
      .spyOn(prisma, '$transaction')
      .mockRejectedValueOnce(new Error('boom'))
    expectErr(await SdTicketTaskRepository.list('t'), 'DATABASE_ERROR')
    expectErr(await SdTicketTaskRepository.findById('a', 't'), 'DATABASE_ERROR')
    expectErr(
      await SdTicketTaskRepository.reorder('t', ['a']),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdTicketTaskRepository.create({
        workspaceId: 'missing',
        ticketId: 'missing',
        createdById: 'missing',
        title: 'x',
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdTicketTaskRepository.update('missing', { title: 'x' }),
      'DATABASE_ERROR',
    )
    expectErr(await SdTicketTaskRepository.delete('missing'), 'DATABASE_ERROR')
    const findManyAgain = vi
      .spyOn(prisma.sdTicketTask, 'findMany')
      .mockRejectedValueOnce(new Error('boom'))
    expectErr(
      await SdTicketTaskRepository.listDueReminders({
        workspaceIds: ['w'],
        now: new Date(),
        soonUntil: new Date(),
        overdueFrom: new Date(),
        limit: 1,
      }),
      'DATABASE_ERROR',
    )
    findManyAgain.mockRestore()
    const updateMany = vi
      .spyOn(prisma.sdTicketTask, 'updateMany')
      .mockRejectedValueOnce(new Error('boom'))
    expectErr(
      await SdTicketTaskRepository.claimReminder('a', 'overdue', new Date()),
      'DATABASE_ERROR',
    )
    updateMany.mockRestore()
    many.mockRestore()
    first.mockRestore()
    tx.mockRestore()
  })
})
