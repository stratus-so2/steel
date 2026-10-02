import { describe, expect, it, vi } from 'vitest'
import {
  seedSdContract,
  seedSdContractPeriod,
  seedSdTimeEntry,
} from '@/src/__tests__/factories/sd-contract.factory'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import {
  seedSdCustomer,
  seedSdPhase,
} from '@/src/__tests__/factories/sd-ticket-context.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdTimeEntryRepository } from '../sd-time-entry.repository'

const DAY_START = new Date('2026-10-07T03:00:00.000Z')
const DAY_END = new Date('2026-10-08T03:00:00.000Z')

async function setup() {
  const [workspace, user, other] = await Promise.all([
    seedWorkspace(),
    seedUser(),
    seedUser(),
  ])
  const phase = await seedSdPhase(workspace.id)
  const customer = await seedSdCustomer(workspace.id, user.id)
  const contract = await seedSdContract(workspace.id, customer.id, user.id)
  const ticket = await seedSdTicket(workspace.id, phase.id, {
    contractId: contract.id,
  })
  const another = await seedSdTicket(workspace.id, phase.id)
  return { workspace, user, other, ticket, another, contract }
}

describe('SdTimeEntryRepository', () => {
  it('creates, lists newest first and scopes findById by ticket', async () => {
    const { workspace, user, ticket, another, contract } = await setup()
    const created = expectOk(
      await SdTimeEntryRepository.create({
        workspaceId: workspace.id,
        ticketId: ticket.id,
        userId: user.id,
        source: 'MANUAL',
        startedAt: new Date('2026-10-07T13:00:00.000Z'),
        endedAt: new Date('2026-10-07T14:00:00.000Z'),
        minutes: 60,
        window: 'AFTER_HOURS',
        amount: '150.00',
        contractId: contract.id,
        description: 'Troca do switch',
      }),
    )
    expect(created.user?.id).toBe(user.id)
    expect(created.amount?.toFixed(2)).toBe('150.00')
    expect(created.window).toBe('AFTER_HOURS')

    await seedSdTimeEntry(workspace.id, ticket.id, user.id, {
      startedAt: new Date('2026-10-07T15:00:00.000Z'),
      endedAt: new Date('2026-10-07T16:00:00.000Z'),
      description: 'Recente',
    })
    await seedSdTimeEntry(workspace.id, another.id, user.id)

    const rows = expectOk(await SdTimeEntryRepository.listByTicket(ticket.id))
    expect(rows.map((row) => row.description)).toEqual([
      'Recente',
      'Troca do switch',
    ])
    expectErr(
      await SdTimeEntryRepository.findById(created.id, another.id),
      'SD_TIME_ENTRY_NOT_FOUND',
    )

    const updated = expectOk(
      await SdTimeEntryRepository.update(created.id, {
        minutes: 75,
        billable: false,
        amount: null,
        periodId: null,
      }),
    )
    expect(updated.minutes).toBe(75)
    expect(updated.billable).toBe(false)
    expect(updated.amount).toBeNull()
  })

  it('finds the running timer of the user only', async () => {
    const { workspace, user, other, ticket } = await setup()
    await seedSdTimeEntry(workspace.id, ticket.id, other.id, { endedAt: null })
    expect(
      expectOk(await SdTimeEntryRepository.findRunning(workspace.id, user.id)),
    ).toBeNull()

    const running = await seedSdTimeEntry(workspace.id, ticket.id, user.id, {
      endedAt: null,
      minutes: 0,
    })
    expect(
      expectOk(await SdTimeEntryRepository.findRunning(workspace.id, user.id))
        ?.id,
    ).toBe(running.id)
  })

  it('soft deletes, hiding the entry from the list and the running lookup', async () => {
    const { workspace, user, ticket } = await setup()
    const entry = await seedSdTimeEntry(workspace.id, ticket.id, user.id, {
      endedAt: null,
    })
    expectOk(await SdTimeEntryRepository.softDelete(entry.id))
    expect(
      expectOk(await SdTimeEntryRepository.listByTicket(ticket.id)),
    ).toHaveLength(0)
    expect(
      expectOk(await SdTimeEntryRepository.findRunning(workspace.id, user.id)),
    ).toBeNull()
    expectErr(
      await SdTimeEntryRepository.findById(entry.id, ticket.id),
      'SD_TIME_ENTRY_NOT_FOUND',
    )
  })

  it('tells whether the user already logged on that ticket that day', async () => {
    const { workspace, user, other, ticket } = await setup()
    const params = {
      ticketId: ticket.id,
      userId: user.id,
      from: DAY_START,
      to: DAY_END,
    }
    expect(
      expectOk(await SdTimeEntryRepository.existsOnTicketDay(params)),
    ).toBe(false)

    const entry = await seedSdTimeEntry(workspace.id, ticket.id, user.id)
    expect(
      expectOk(await SdTimeEntryRepository.existsOnTicketDay(params)),
    ).toBe(true)
    // Ele mesmo, excluído da conta (edição), não conta.
    expect(
      expectOk(
        await SdTimeEntryRepository.existsOnTicketDay({
          ...params,
          excludeId: entry.id,
        }),
      ),
    ).toBe(false)
    // Outro usuário, cronômetro aberto e outro dia também não contam.
    expect(
      expectOk(
        await SdTimeEntryRepository.existsOnTicketDay({
          ...params,
          userId: other.id,
        }),
      ),
    ).toBe(false)
    await prisma.sdTimeEntry.update({
      where: { id: entry.id },
      data: { endedAt: null },
    })
    expect(
      expectOk(await SdTimeEntryRepository.existsOnTicketDay(params)),
    ).toBe(false)
  })

  it('lists the closed entries of a period in chronological order and links them', async () => {
    const { workspace, user, ticket, another, contract } = await setup()
    const later = await seedSdTimeEntry(workspace.id, ticket.id, user.id, {
      contractId: contract.id,
      startedAt: new Date('2026-10-20T13:00:00.000Z'),
      endedAt: new Date('2026-10-20T14:00:00.000Z'),
    })
    const earlier = await seedSdTimeEntry(workspace.id, ticket.id, user.id, {
      contractId: contract.id,
      startedAt: new Date('2026-10-05T13:00:00.000Z'),
      endedAt: new Date('2026-10-05T14:00:00.000Z'),
    })
    // Fora da janela, sem contrato e cronômetro aberto ficam de fora.
    await seedSdTimeEntry(workspace.id, ticket.id, user.id, {
      contractId: contract.id,
      startedAt: new Date('2026-11-05T13:00:00.000Z'),
      endedAt: new Date('2026-11-05T14:00:00.000Z'),
    })
    await seedSdTimeEntry(workspace.id, another.id, user.id)
    await seedSdTimeEntry(workspace.id, ticket.id, user.id, {
      contractId: contract.id,
      endedAt: null,
    })

    const rows = expectOk(
      await SdTimeEntryRepository.listForPeriod(
        contract.id,
        new Date('2026-10-01T00:00:00.000Z'),
        new Date('2026-11-01T00:00:00.000Z'),
      ),
    )
    expect(rows.map((row) => row.id)).toEqual([earlier.id, later.id])
    expect(rows[0].ticket.type).toBe('INCIDENT')

    const period = await seedSdContractPeriod(workspace.id, contract.id)
    expect(
      expectOk(
        await SdTimeEntryRepository.linkPeriod(
          rows.map((row) => row.id),
          period.id,
        ),
      ),
    ).toBe(2)
    expect(
      expectOk(await SdTimeEntryRepository.linkPeriod([], period.id)),
    ).toBe(0)
    expect(
      expectOk(await SdTimeEntryRepository.findById(earlier.id, ticket.id))
        .periodId,
    ).toBe(period.id)
  })

  it('maps failures to DATABASE_ERROR', async () => {
    const many = vi
      .spyOn(prisma.sdTimeEntry, 'findMany')
      .mockRejectedValue(new Error('boom'))
    const first = vi
      .spyOn(prisma.sdTimeEntry, 'findFirst')
      .mockRejectedValue(new Error('boom'))
    const count = vi
      .spyOn(prisma.sdTimeEntry, 'count')
      .mockRejectedValueOnce(new Error('boom'))
    const updateMany = vi
      .spyOn(prisma.sdTimeEntry, 'updateMany')
      .mockRejectedValueOnce(new Error('boom'))

    expectErr(
      await SdTimeEntryRepository.findRunning('ws', 'u'),
      'DATABASE_ERROR',
    )
    expectErr(await SdTimeEntryRepository.listByTicket('t'), 'DATABASE_ERROR')
    expectErr(await SdTimeEntryRepository.findById('e', 't'), 'DATABASE_ERROR')
    expectErr(
      await SdTimeEntryRepository.existsOnTicketDay({
        ticketId: 't',
        userId: 'u',
        from: DAY_START,
        to: DAY_END,
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdTimeEntryRepository.listForPeriod('c', DAY_START, DAY_END),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdTimeEntryRepository.linkPeriod(['e'], 'p'),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdTimeEntryRepository.create({
        workspaceId: 'missing',
        ticketId: 'missing',
        userId: 'missing',
        startedAt: DAY_START,
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdTimeEntryRepository.update('missing', { minutes: 1 }),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdTimeEntryRepository.softDelete('missing'),
      'DATABASE_ERROR',
    )

    many.mockRestore()
    first.mockRestore()
    count.mockRestore()
    updateMany.mockRestore()
  })
})
