import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedCrmOpportunity } from '@/src/__tests__/factories/crm-opportunity.factory'
import {
  seedCrmPipeline,
  seedCrmPipelineStage,
} from '@/src/__tests__/factories/crm-pipeline.factory'
import { seedCrmTask } from '@/src/__tests__/factories/crm-task.factory'
import { seedSdTimeEntry } from '@/src/__tests__/factories/sd-contract.factory'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import {
  seedSdCalendar,
  seedSdPhase,
} from '@/src/__tests__/factories/sd-ticket-context.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { ProductivityRepository } from '../productivity.repository'
import { WorklogRepository, type WorklogWhere } from '../worklog.repository'

const RANGE = {
  from: new Date('2026-10-05T03:00:00.000Z'),
  to: new Date('2026-10-12T03:00:00.000Z'),
}

async function setup() {
  const [workspace, ana, bruno] = await Promise.all([
    seedWorkspace(),
    seedUser({ name: 'Ana' }),
    seedUser({ name: 'Bruno' }),
  ])
  await prisma.membership.createMany({
    data: [
      { workspaceId: workspace.id, userId: bruno.id, role: 'MEMBER' },
      { workspaceId: workspace.id, userId: ana.id, role: 'OWNER' },
    ],
  })
  const phase = await seedSdPhase(workspace.id)
  const ticket = await seedSdTicket(workspace.id, phase.id, {
    title: 'Sem internet',
    assigneeId: ana.id,
    resolvedAt: new Date('2026-10-07T15:00:00.000Z'),
    reopenCount: 1,
  })
  const change = await seedSdTicket(workspace.id, phase.id, { type: 'CHANGE' })
  const at = (iso: string) => new Date(iso)
  const e1 = await seedSdTimeEntry(workspace.id, ticket.id, ana.id, {
    startedAt: at('2026-10-06T12:00:00.000Z'),
    endedAt: at('2026-10-06T13:30:00.000Z'),
    minutes: 90,
    billable: true,
    source: 'TIMER',
    amount: '150.00',
  })
  const e2 = await seedSdTimeEntry(workspace.id, change.id, bruno.id, {
    startedAt: at('2026-10-07T12:00:00.000Z'),
    minutes: 30,
    billable: false,
    source: 'MANUAL',
  })
  // Outside the range, deleted and still running: never listed.
  await seedSdTimeEntry(workspace.id, ticket.id, ana.id, {
    startedAt: at('2026-09-20T12:00:00.000Z'),
    minutes: 45,
  })
  await seedSdTimeEntry(workspace.id, ticket.id, ana.id, {
    startedAt: at('2026-10-06T15:00:00.000Z'),
    deletedAt: at('2026-10-06T16:00:00.000Z'),
  })
  await seedSdTimeEntry(workspace.id, ticket.id, ana.id, {
    startedAt: at('2026-10-08T15:00:00.000Z'),
    endedAt: null,
    minutes: 0,
  })
  return { workspace, ana, bruno, ticket, change, e1, e2 }
}

const where = (workspaceId: string, extra: Partial<WorklogWhere> = {}) => ({
  workspaceId,
  ...RANGE,
  ...extra,
})

describe('WorklogRepository', () => {
  it('pages closed entries newest first with user and ticket', async () => {
    const { workspace, e1, e2 } = await setup()
    const page = expectOk(
      await WorklogRepository.listPage(where(workspace.id), {
        skip: 0,
        take: 1,
      }),
    )
    expect(page.total).toBe(2)
    expect(page.rows.map((r) => r.id)).toEqual([e2.id])
    expect(page.rows[0].ticket.type).toBe('CHANGE')
    const next = expectOk(
      await WorklogRepository.listPage(where(workspace.id), {
        skip: 1,
        take: 1,
      }),
    )
    expect(next.rows[0].id).toBe(e1.id)
    expect(next.rows[0].user.name).toBe('Ana')
  })

  it('filters by person, ticket, billable and source', async () => {
    const { workspace, ana, ticket, e1, e2 } = await setup()
    const ids = async (extra: Partial<WorklogWhere>) =>
      expectOk(
        await WorklogRepository.listPage(where(workspace.id, extra), {
          skip: 0,
          take: 10,
        }),
      ).rows.map((r) => r.id)
    expect(await ids({ userId: ana.id })).toEqual([e1.id])
    expect(
      await ids({ ticket: { number: ticket.number, type: null } }),
    ).toEqual([e1.id])
    expect(
      await ids({ ticket: { number: ticket.number, type: 'CHANGE' } }),
    ).toEqual([])
    expect(await ids({ billable: false })).toEqual([e2.id])
    expect(await ids({ source: 'TIMER' })).toEqual([e1.id])
  })

  it('totals minutes, billable, timer and amount', async () => {
    const { workspace } = await setup()
    expect(
      expectOk(await WorklogRepository.totals(where(workspace.id))),
    ).toEqual({
      entries: 2,
      minutes: 120,
      billableMinutes: 90,
      timerMinutes: 90,
      amount: '150.00',
    })
    expect(
      expectOk(
        await WorklogRepository.totals(where(workspace.id, { userId: 'none' })),
      ),
    ).toEqual({
      entries: 0,
      minutes: 0,
      billableMinutes: 0,
      timerMinutes: 0,
      amount: '0.00',
    })
  })

  it('reads batches with a keyset cursor', async () => {
    const { workspace, e1, e2 } = await setup()
    const first = expectOk(
      await WorklogRepository.listBatch(where(workspace.id), 1),
    )
    expect(first.map((r) => r.id)).toEqual([e2.id])
    const second = expectOk(
      await WorklogRepository.listBatch(where(workspace.id), 1, e2.id),
    )
    expect(second.map((r) => r.id)).toEqual([e1.id])
  })

  it('lists members alphabetically and reads calendar and prefixes', async () => {
    const { workspace } = await setup()
    expect(
      expectOk(await WorklogRepository.members(workspace.id)).map(
        (m) => m.name,
      ),
    ).toEqual(['Ana', 'Bruno'])

    expect(
      expectOk(await WorklogRepository.defaultCalendar(workspace.id)),
    ).toBe(null)
    const first = await seedSdCalendar(workspace.id, { name: 'Primeiro' })
    expect(
      expectOk(await WorklogRepository.defaultCalendar(workspace.id))?.id,
    ).toBe(first.id)
    const main = await seedSdCalendar(workspace.id, {
      name: 'Principal',
      isDefault: true,
    })
    expect(
      expectOk(await WorklogRepository.defaultCalendar(workspace.id))?.id,
    ).toBe(main.id)

    // seedSdTicket created the settings row with the default prefixes.
    expect(
      expectOk(await WorklogRepository.ticketPrefixes(workspace.id)),
    ).not.toBeNull()
    const empty = await seedWorkspace()
    expect(
      expectOk(await WorklogRepository.ticketPrefixes(empty.id)),
    ).toBeNull()
  })
})

describe('ProductivityRepository', () => {
  it('reads time entries and resolved tickets with their logged minutes', async () => {
    const { workspace, ana, bruno, ticket } = await setup()
    const entries = expectOk(
      await ProductivityRepository.timeEntries(workspace.id, RANGE),
    )
    expect(entries).toHaveLength(2)
    expect(entries.find((e) => e.userId === ana.id)?.amount).toBe('150')
    expect(entries.find((e) => e.userId === bruno.id)?.amount).toBeNull()
    expect(
      expectOk(
        await ProductivityRepository.timeEntries(workspace.id, RANGE, bruno.id),
      ),
    ).toHaveLength(1)

    const phase = await seedSdPhase(workspace.id, { name: 'Resolvido' })
    await seedSdTicket(workspace.id, phase.id, {
      assigneeId: bruno.id,
      resolvedAt: new Date('2026-10-08T15:00:00.000Z'),
    })
    const tickets = expectOk(
      await ProductivityRepository.resolvedTickets(workspace.id, RANGE),
    )
    expect(tickets).toHaveLength(2)
    expect(tickets.find((t) => t.assigneeId === bruno.id)?.loggedMinutes).toBe(
      0,
    )
    const anaTicket = tickets.filter((t) => t.assigneeId === ana.id)
    expect(anaTicket[0]).toMatchObject({
      assigneeId: ana.id,
      reopenCount: 1,
      // 90 (in range) + 45 (older) — deleted and running entries excluded.
      loggedMinutes: 135,
    })
    expect(anaTicket[0].resolvedAt).toEqual(ticket.resolvedAt)
    expect(
      expectOk(
        await ProductivityRepository.resolvedTickets(
          workspace.id,
          RANGE,
          ana.id,
        ),
      ),
    ).toHaveLength(1)
    expect(
      expectOk(
        await ProductivityRepository.resolvedTickets(workspace.id, {
          from: new Date('2025-01-01T00:00:00.000Z'),
          to: new Date('2025-02-01T00:00:00.000Z'),
        }),
      ),
    ).toEqual([])
  })

  it('reads CRM tasks done and deals won in the window', async () => {
    const { workspace, ana, bruno } = await setup()
    const task = await seedCrmTask(workspace.id, ana.id, {
      status: 'DONE',
      assigneeId: bruno.id,
    })
    await prisma.crmTask.update({
      where: { id: task.id },
      data: { updatedAt: new Date('2026-10-06T12:00:00.000Z') },
    })
    await seedCrmTask(workspace.id, ana.id, { status: 'TODO' })

    const pipeline = await seedCrmPipeline(workspace.id, ana.id)
    const won = await seedCrmPipelineStage(pipeline.id, { category: 'WON' })
    const open = await seedCrmPipelineStage(pipeline.id, { category: 'OPEN' })
    const deal = await seedCrmOpportunity(
      workspace.id,
      ana.id,
      pipeline.id,
      won.id,
      { amount: '1000.50' as never },
    )
    await prisma.crmOpportunity.update({
      where: { id: deal.id },
      data: {
        ownerId: ana.id,
        closeDate: new Date('2026-10-08T12:00:00.000Z'),
      },
    })
    const noAmount = await seedCrmOpportunity(
      workspace.id,
      ana.id,
      pipeline.id,
      won.id,
    )
    await prisma.crmOpportunity.update({
      where: { id: noAmount.id },
      data: { closeDate: new Date('2026-10-09T12:00:00.000Z') },
    })
    const lost = await seedCrmOpportunity(
      workspace.id,
      ana.id,
      pipeline.id,
      open.id,
    )
    await prisma.crmOpportunity.update({
      where: { id: lost.id },
      data: { closeDate: new Date('2026-10-08T12:00:00.000Z') },
    })

    expect(
      expectOk(
        await ProductivityRepository.completedTasks(workspace.id, RANGE),
      ),
    ).toEqual([
      {
        assigneeId: bruno.id,
        completedAt: new Date('2026-10-06T12:00:00.000Z'),
      },
    ])
    expect(
      expectOk(
        await ProductivityRepository.completedTasks(
          workspace.id,
          RANGE,
          ana.id,
        ),
      ),
    ).toEqual([])
    const wins = expectOk(
      await ProductivityRepository.wonOpportunities(workspace.id, RANGE),
    )
    expect(wins).toHaveLength(2)
    expect(wins.find((w) => w.ownerId === ana.id)?.amount).toBe('1000.5')
    expect(wins.find((w) => w.ownerId === null)?.amount).toBeNull()
    expect(
      expectOk(
        await ProductivityRepository.wonOpportunities(
          workspace.id,
          RANGE,
          ana.id,
        ),
      ),
    ).toHaveLength(1)
  })

  it('counts each conversation a person replied to once, at the first reply', async () => {
    const { workspace, ana, bruno } = await setup()
    const connection = await prisma.whatsAppConnection.create({
      data: {
        workspaceId: workspace.id,
        module: 'COMMUNICATION',
        provider: 'ZAPI',
        label: 'Atendimento',
        phoneNumber: '5511988887777',
        createdById: ana.id,
      },
    })
    const contact = await prisma.whatsAppContact.create({
      data: { workspaceId: workspace.id, waId: '5511977776666' },
    })
    const conversation = await prisma.whatsAppConversation.create({
      data: {
        workspaceId: workspace.id,
        connectionId: connection.id,
        contactId: contact.id,
      },
    })
    const message = (overrides: Record<string, unknown>): Promise<unknown> =>
      prisma.whatsAppMessage.create({
        data: {
          workspaceId: workspace.id,
          conversationId: conversation.id,
          direction: 'OUT',
          type: 'TEXT',
          text: 'Olá',
          ...overrides,
        } as never,
      })
    await message({
      senderUserId: ana.id,
      createdAt: new Date('2026-10-06T12:00:00.000Z'),
    })
    await message({
      senderUserId: ana.id,
      createdAt: new Date('2026-10-06T13:00:00.000Z'),
    })
    await message({
      senderUserId: bruno.id,
      createdAt: new Date('2026-10-07T12:00:00.000Z'),
    })
    // AI, incoming and out-of-range messages never count.
    await message({
      sentByAi: true,
      createdAt: new Date('2026-10-06T12:00:00Z'),
    })
    await message({
      direction: 'IN',
      createdAt: new Date('2026-10-06T12:00:00.000Z'),
    })
    await message({
      senderUserId: ana.id,
      createdAt: new Date('2026-09-01T12:00:00.000Z'),
    })

    const all = expectOk(
      await ProductivityRepository.conversationsHandled(workspace.id, RANGE),
    )
    expect(all).toHaveLength(2)
    expect(all.find((c) => c.userId === ana.id)?.at).toEqual(
      new Date('2026-10-06T12:00:00.000Z'),
    )
    expect(
      expectOk(
        await ProductivityRepository.conversationsHandled(
          workspace.id,
          RANGE,
          bruno.id,
        ),
      ),
    ).toHaveLength(1)
  })
})

describe('Worklog and productivity repositories — database failures', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns DATABASE_ERROR when Prisma throws', async () => {
    const boom = (() => Promise.reject(new Error('boom'))) as never
    vi.spyOn(prisma.sdTimeEntry, 'findMany').mockImplementation(boom)
    vi.spyOn(prisma.sdTimeEntry, 'count').mockImplementation(boom)
    vi.spyOn(prisma.sdTimeEntry, 'groupBy').mockImplementation(boom)
    vi.spyOn(prisma.membership, 'findMany').mockImplementation(boom)
    vi.spyOn(prisma.sdBusinessCalendar, 'findFirst').mockImplementation(boom)
    vi.spyOn(prisma.sdSettings, 'findUnique').mockImplementation(boom)
    vi.spyOn(prisma.sdTicket, 'findMany').mockImplementation(boom)
    vi.spyOn(prisma.crmTask, 'findMany').mockImplementation(boom)
    vi.spyOn(prisma.crmOpportunity, 'findMany').mockImplementation(boom)
    vi.spyOn(prisma.whatsAppMessage, 'groupBy').mockImplementation(boom)

    const w = where('ws')
    expectErr(
      await WorklogRepository.listPage(w, { skip: 0, take: 1 }),
      'DATABASE_ERROR',
    )
    expectErr(await WorklogRepository.listBatch(w, 1), 'DATABASE_ERROR')
    expectErr(await WorklogRepository.totals(w), 'DATABASE_ERROR')
    expectErr(await WorklogRepository.members('ws'), 'DATABASE_ERROR')
    expectErr(await WorklogRepository.defaultCalendar('ws'), 'DATABASE_ERROR')
    expectErr(await WorklogRepository.ticketPrefixes('ws'), 'DATABASE_ERROR')
    for (const read of [
      ProductivityRepository.timeEntries,
      ProductivityRepository.resolvedTickets,
      ProductivityRepository.completedTasks,
      ProductivityRepository.wonOpportunities,
      ProductivityRepository.conversationsHandled,
    ]) {
      expectErr(await read('ws', RANGE), 'DATABASE_ERROR')
    }
  })
})
