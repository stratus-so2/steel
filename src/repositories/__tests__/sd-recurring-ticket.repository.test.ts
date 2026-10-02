import { describe, expect, it } from 'vitest'
import { seedSdConfigItem } from '@/src/__tests__/factories/sd-config-item.factory'
import { seedSdCustomer } from '@/src/__tests__/factories/sd-customer.factory'
import {
  seedSdRecurringRun,
  seedSdRecurringTicket,
} from '@/src/__tests__/factories/sd-recurring-ticket.factory'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import { seedSdPhase } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import {
  SdRecurringTicketRepository,
  SdRecurringTicketRunRepository,
} from '../sd-recurring-ticket.repository'

async function setup() {
  const [workspace, other, user] = await Promise.all([
    seedWorkspace(),
    seedWorkspace(),
    seedUser(),
  ])
  return { workspace, other, user }
}

describe('SdRecurringTicketRepository', () => {
  it('creates a rule with the relations and scopes the list by workspace', async () => {
    const { workspace, other, user } = await setup()
    const customer = await seedSdCustomer(workspace.id, user.id, {
      name: 'ACME',
    })
    const configItem = await seedSdConfigItem(workspace.id, user.id, {
      name: 'Servidor de arquivos',
      code: 'SRV-01',
    })

    const created = expectOk(
      await SdRecurringTicketRepository.create(workspace.id, {
        name: 'Vistoria mensal',
        ticketType: 'SERVICE_REQUEST',
        startsAt: new Date('2026-10-01T03:00:00.000Z'),
        createdById: user.id,
        customerId: customer.id,
        configItemId: configItem.id,
        byMonthday: 10,
        nextRunAt: new Date('2026-10-10T11:00:00.000Z'),
      }),
    )
    await seedSdRecurringTicket(other.id, user.id)

    expect(created).toMatchObject({
      frequency: 'MONTHLY',
      interval: 1,
      atTime: '08:00',
      timezone: 'America/Sao_Paulo',
      skipIfOpen: true,
      active: true,
    })
    expect(created.customer?.name).toBe('ACME')
    expect(created.configItem?.code).toBe('SRV-01')
    expect(created._count.runs).toBe(0)

    const rows = expectOk(await SdRecurringTicketRepository.list(workspace.id))
    expect(rows.map((r) => r.id)).toEqual([created.id])
  })

  it('hides the inactive ones unless asked, and the deleted ones always', async () => {
    const { workspace, user } = await setup()
    const active = await seedSdRecurringTicket(workspace.id, user.id, {
      name: 'Ativa',
    })
    const paused = await seedSdRecurringTicket(workspace.id, user.id, {
      name: 'Pausada',
      active: false,
    })
    const removed = await seedSdRecurringTicket(workspace.id, user.id, {
      name: 'Removida',
      deletedAt: new Date(),
    })

    const visible = expectOk(
      await SdRecurringTicketRepository.list(workspace.id),
    )
    expect(visible.map((r) => r.id)).toEqual([active.id])

    const all = expectOk(
      await SdRecurringTicketRepository.list(workspace.id, {
        includeInactive: true,
      }),
    )
    expect(all.map((r) => r.id)).toEqual([active.id, paused.id])
    expect(all.map((r) => r.id)).not.toContain(removed.id)
  })

  it('filters by ticket type, config item and customer', async () => {
    const { workspace, user } = await setup()
    const customer = await seedSdCustomer(workspace.id, user.id)
    const configItem = await seedSdConfigItem(workspace.id, user.id)
    const matching = await seedSdRecurringTicket(workspace.id, user.id, {
      ticketType: 'CHANGE',
      customerId: customer.id,
      configItemId: configItem.id,
    })
    await seedSdRecurringTicket(workspace.id, user.id, {
      ticketType: 'INCIDENT',
    })

    expect(
      expectOk(
        await SdRecurringTicketRepository.list(workspace.id, {
          ticketType: 'CHANGE',
        }),
      ).map((r) => r.id),
    ).toEqual([matching.id])
    expect(
      expectOk(
        await SdRecurringTicketRepository.list(workspace.id, {
          configItemId: configItem.id,
        }),
      ).map((r) => r.id),
    ).toEqual([matching.id])
    expect(
      expectOk(
        await SdRecurringTicketRepository.list(workspace.id, {
          customerId: customer.id,
        }),
      ).map((r) => r.id),
    ).toEqual([matching.id])
  })

  it('finds by id inside the workspace only', async () => {
    const { workspace, other, user } = await setup()
    const rule = await seedSdRecurringTicket(workspace.id, user.id)

    expect(
      expectOk(
        await SdRecurringTicketRepository.findById(rule.id, workspace.id),
      ).id,
    ).toBe(rule.id)
    expectErr(
      await SdRecurringTicketRepository.findById(rule.id, other.id),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('updates the schedule stamps and soft-deletes', async () => {
    const { workspace, user } = await setup()
    const rule = await seedSdRecurringTicket(workspace.id, user.id)

    const updated = expectOk(
      await SdRecurringTicketRepository.update(rule.id, workspace.id, {
        frequency: 'DAILY',
        interval: 2,
        byWeekday: [1, 3],
        atTime: '07:30',
        lastRunAt: new Date('2026-10-05T11:00:00.000Z'),
        nextRunAt: new Date('2026-10-07T10:30:00.000Z'),
      }),
    )
    expect(updated).toMatchObject({
      frequency: 'DAILY',
      interval: 2,
      byWeekday: [1, 3],
      atTime: '07:30',
    })

    expectOk(
      await SdRecurringTicketRepository.softDelete(rule.id, workspace.id),
    )
    const row = await prisma.sdRecurringTicket.findUnique({
      where: { id: rule.id },
    })
    expect(row?.deletedAt).not.toBeNull()
    expect(row).toMatchObject({ active: false, nextRunAt: null })
    expectErr(
      await SdRecurringTicketRepository.findById(rule.id, workspace.id),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('reports a missing id in an update as SD_CONFIG_NOT_FOUND', async () => {
    const { workspace } = await setup()
    expectErr(
      await SdRecurringTicketRepository.update('nope', workspace.id, {
        name: 'x',
      }),
      'SD_CONFIG_NOT_FOUND',
    )
    expectErr(
      await SdRecurringTicketRepository.softDelete('nope', workspace.id),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('lists only the due, active and not deleted rules, oldest first', async () => {
    const { workspace, user } = await setup()
    const now = new Date('2026-10-10T12:00:00.000Z')
    const older = await seedSdRecurringTicket(workspace.id, user.id, {
      nextRunAt: new Date('2026-10-09T11:00:00.000Z'),
    })
    const due = await seedSdRecurringTicket(workspace.id, user.id, {
      nextRunAt: new Date('2026-10-10T11:00:00.000Z'),
    })
    await seedSdRecurringTicket(workspace.id, user.id, {
      nextRunAt: new Date('2026-10-11T11:00:00.000Z'),
    })
    await seedSdRecurringTicket(workspace.id, user.id, {
      nextRunAt: new Date('2026-10-01T11:00:00.000Z'),
      active: false,
    })
    await seedSdRecurringTicket(workspace.id, user.id, {
      nextRunAt: new Date('2026-10-01T11:00:00.000Z'),
      deletedAt: new Date(),
    })
    await seedSdRecurringTicket(workspace.id, user.id, { nextRunAt: null })

    const rows = expectOk(await SdRecurringTicketRepository.listDue(now, 10))
    expect(rows.map((r) => r.id)).toEqual([older.id, due.id])

    const limited = expectOk(await SdRecurringTicketRepository.listDue(now, 1))
    expect(limited.map((r) => r.id)).toEqual([older.id])
  })

  it('points out the ids that do not belong to the workspace', async () => {
    const { workspace, other, user } = await setup()
    const customer = await seedSdCustomer(workspace.id, user.id)
    const configItem = await seedSdConfigItem(workspace.id, user.id)
    const foreign = await seedSdCustomer(other.id, user.id)

    expect(
      expectOk(
        await SdRecurringTicketRepository.findMissingRefs(workspace.id, {
          customerId: customer.id,
          configItemId: configItem.id,
        }),
      ),
    ).toEqual([])
    expect(
      expectOk(
        await SdRecurringTicketRepository.findMissingRefs(workspace.id, {
          customerId: foreign.id,
          configItemId: 'nope',
        }),
      ),
    ).toEqual(['customer', 'configItem'])
    expect(
      expectOk(
        await SdRecurringTicketRepository.findMissingRefs(workspace.id, {}),
      ),
    ).toEqual([])
  })
})

describe('SdRecurringTicketRunRepository', () => {
  it('claims an occurrence once and refuses the duplicate silently', async () => {
    const { workspace, user } = await setup()
    const rule = await seedSdRecurringTicket(workspace.id, user.id)
    const scheduledFor = new Date('2026-11-05T11:00:00.000Z')

    const first = expectOk(
      await SdRecurringTicketRunRepository.claim({
        workspaceId: workspace.id,
        recurringId: rule.id,
        scheduledFor,
      }),
    )
    expect(first).toMatchObject({ status: 'CREATED', ticketId: null })

    const again = expectOk(
      await SdRecurringTicketRunRepository.claim({
        workspaceId: workspace.id,
        recurringId: rule.id,
        scheduledFor,
      }),
    )
    expect(again).toBeNull()
    expect(
      await prisma.sdRecurringTicketRun.count({
        where: { recurringId: rule.id },
      }),
    ).toBe(1)
  })

  it('fails the claim with a database error when the rule does not exist', async () => {
    const { workspace } = await setup()
    expectErr(
      await SdRecurringTicketRunRepository.claim({
        workspaceId: workspace.id,
        recurringId: 'nope',
        scheduledFor: new Date('2026-11-05T11:00:00.000Z'),
      }),
      'DATABASE_ERROR',
    )
  })

  it('finishes a run with the ticket and lists the history newest first', async () => {
    const { workspace, user } = await setup()
    const rule = await seedSdRecurringTicket(workspace.id, user.id)
    const phase = await seedSdPhase(workspace.id, { isInitial: true })
    const ticket = await seedSdTicket(workspace.id, phase.id, {
      title: 'Vistoria de outubro',
    })

    const claimed = expectOk(
      await SdRecurringTicketRunRepository.claim({
        workspaceId: workspace.id,
        recurringId: rule.id,
        scheduledFor: new Date('2026-10-05T11:00:00.000Z'),
      }),
    )
    const finished = expectOk(
      await SdRecurringTicketRunRepository.finish(
        (claimed as { id: string }).id,
        { status: 'CREATED', ticketId: ticket.id },
      ),
    )
    expect(finished.ticket).toMatchObject({ title: 'Vistoria de outubro' })

    await seedSdRecurringRun(workspace.id, rule.id, {
      scheduledFor: new Date('2026-11-05T11:00:00.000Z'),
      status: 'SKIPPED',
      reason: 'A ocorrência anterior ainda está aberta',
    })

    const runs = expectOk(
      await SdRecurringTicketRunRepository.listByRecurring(
        rule.id,
        workspace.id,
        10,
      ),
    )
    expect(runs.map((r) => r.status)).toEqual(['SKIPPED', 'CREATED'])
  })

  it('reports a missing run on finish as SD_CONFIG_NOT_FOUND', async () => {
    expectErr(
      await SdRecurringTicketRunRepository.finish('nope', { status: 'FAILED' }),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('finds the latest run that opened a ticket, with its phase', async () => {
    const { workspace, user } = await setup()
    const rule = await seedSdRecurringTicket(workspace.id, user.id)
    const phase = await seedSdPhase(workspace.id, {
      isInitial: true,
      category: 'IN_PROGRESS',
    })
    const ticket = await seedSdTicket(workspace.id, phase.id)

    await seedSdRecurringRun(workspace.id, rule.id, {
      scheduledFor: new Date('2026-09-05T11:00:00.000Z'),
      status: 'CREATED',
      ticketId: ticket.id,
    })
    await seedSdRecurringRun(workspace.id, rule.id, {
      scheduledFor: new Date('2026-10-05T11:00:00.000Z'),
      status: 'SKIPPED',
      reason: 'ainda aberta',
    })

    const latest = expectOk(
      await SdRecurringTicketRunRepository.findLatestWithTicket(rule.id),
    )
    expect(latest?.ticket).toMatchObject({
      id: ticket.id,
      phase: { category: 'IN_PROGRESS' },
    })

    expect(
      expectOk(
        await SdRecurringTicketRunRepository.findLatestWithTicket('nope'),
      ),
    ).toBeNull()
  })
})
