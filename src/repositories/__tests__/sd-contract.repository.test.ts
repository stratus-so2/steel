import { describe, expect, it, vi } from 'vitest'
import {
  seedSdContract,
  seedSdContractRate,
} from '@/src/__tests__/factories/sd-contract.factory'
import {
  seedSdCalendar,
  seedSdCustomer,
  seedSdPriority,
  seedSdSlaPolicy,
} from '@/src/__tests__/factories/sd-ticket-context.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdContractRepository } from '../sd-contract.repository'

async function setup() {
  const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
  const customer = await seedSdCustomer(workspace.id, user.id, {
    name: 'Stratus',
  })
  const other = await seedSdCustomer(workspace.id, user.id, {
    name: 'Outra empresa',
  })
  return { workspace, user, customer, other }
}

const JAN = new Date('2026-01-01T00:00:00.000Z')
const JUL = new Date('2026-07-01T00:00:00.000Z')

describe('SdContractRepository', () => {
  it('creates with the rate table, reads it back and filters the list', async () => {
    const { workspace, user, customer, other } = await setup()
    const priority = await seedSdPriority(workspace.id)

    const created = expectOk(
      await SdContractRepository.create(
        workspace.id,
        user.id,
        {
          customerId: customer.id,
          name: 'Suporte 20 h',
          code: 'CT-1',
          status: 'ACTIVE',
          startsAt: JAN,
          endsAt: null,
          billingCycle: 'MONTHLY',
          includedMinutes: 1200,
          carryOver: true,
          hourlyRate: '150.00',
          overtimeRate: '200.00',
          roundingMinutes: 15,
          minimumMinutes: 30,
          ticketTypes: ['INCIDENT'],
          slaPolicyId: null,
          notes: null,
        },
        [
          {
            ticketType: null,
            priorityId: priority.id,
            window: 'AFTER_HOURS',
            hourlyRate: '300.00',
            multiplier: '1.50',
          },
          {
            ticketType: 'CHANGE',
            priorityId: null,
            window: 'HOLIDAY',
            hourlyRate: '400.00',
            multiplier: '2.00',
          },
        ],
      ),
    )
    expect(created.rates).toHaveLength(2)
    expect(created.rates[0].position).toBe(0)
    expect(created.rates[0].priority?.id).toBe(priority.id)
    expect(created.hourlyRate.toFixed(2)).toBe('150.00')
    expect(created.customer?.name).toBe('Stratus')

    await seedSdContract(workspace.id, other.id, user.id, {
      name: 'Rascunho',
      status: 'DRAFT',
    })

    expect(
      expectOk(await SdContractRepository.list(workspace.id)),
    ).toHaveLength(2)
    expect(
      expectOk(
        await SdContractRepository.list(workspace.id, {
          customerId: customer.id,
        }),
      ).map((row) => row.name),
    ).toEqual(['Suporte 20 h'])
    expect(
      expectOk(
        await SdContractRepository.list(workspace.id, { status: 'DRAFT' }),
      ).map((row) => row.name),
    ).toEqual(['Rascunho'])
    expect(
      expectOk(
        await SdContractRepository.list(workspace.id, { q: 'stratus' }),
      ).map((row) => row.name),
    ).toEqual(['Suporte 20 h'])
    expect(
      expectOk(await SdContractRepository.list(workspace.id, { q: 'CT-1' })),
    ).toHaveLength(1)

    expect(
      expectOk(await SdContractRepository.findById(created.id, workspace.id))
        .id,
    ).toBe(created.id)
    const stranger = await seedWorkspace()
    expectErr(
      await SdContractRepository.findById(created.id, stranger.id),
      'SD_CONTRACT_NOT_FOUND',
    )
  })

  it('replaces the whole rate table on update and keeps it when omitted', async () => {
    const { workspace, user, customer } = await setup()
    const contract = await seedSdContract(workspace.id, customer.id, user.id)
    await seedSdContractRate(contract.id)

    const kept = expectOk(
      await SdContractRepository.update(contract.id, { name: 'Novo nome' }),
    )
    expect(kept.name).toBe('Novo nome')
    expect(kept.rates).toHaveLength(1)

    const replaced = expectOk(
      await SdContractRepository.update(contract.id, {}, [
        {
          ticketType: null,
          priorityId: null,
          window: 'WEEKEND',
          hourlyRate: '500.00',
          multiplier: '1.00',
        },
      ]),
    )
    expect(replaced.rates).toHaveLength(1)
    expect(replaced.rates[0].window).toBe('WEEKEND')

    const emptied = expectOk(
      await SdContractRepository.update(contract.id, {}, []),
    )
    expect(emptied.rates).toHaveLength(0)
  })

  it('soft deletes, hiding the contract and marking it as ended', async () => {
    const { workspace, user, customer } = await setup()
    const contract = await seedSdContract(workspace.id, customer.id, user.id)

    expectOk(await SdContractRepository.softDelete(contract.id))
    expectErr(
      await SdContractRepository.findById(contract.id, workspace.id),
      'SD_CONTRACT_NOT_FOUND',
    )
    expect(
      expectOk(await SdContractRepository.findByIdUnscoped(contract.id)),
    ).toBeNull()
    const row = await prisma.sdContract.findUnique({
      where: { id: contract.id },
    })
    expect(row?.status).toBe('ENDED')
    expect(row?.deletedAt).not.toBeNull()
  })

  it('resolves the active contract that covers the ticket type', async () => {
    const { workspace, user, customer } = await setup()
    const at = new Date('2026-03-01T12:00:00.000Z')
    const scoped = await seedSdContract(workspace.id, customer.id, user.id, {
      name: 'Só mudanças',
      ticketTypes: ['CHANGE'],
    })

    expect(
      expectOk(
        await SdContractRepository.findActiveForCustomer(
          workspace.id,
          customer.id,
          'CHANGE',
          at,
        ),
      )?.id,
    ).toBe(scoped.id)
    expect(
      expectOk(
        await SdContractRepository.findActiveForCustomer(
          workspace.id,
          customer.id,
          'INCIDENT',
          at,
        ),
      ),
    ).toBeNull()

    await prisma.sdContract.update({
      where: { id: scoped.id },
      data: { ticketTypes: [] },
    })
    expect(
      expectOk(
        await SdContractRepository.findActiveForCustomer(
          workspace.id,
          customer.id,
          'INCIDENT',
          at,
        ),
      )?.id,
    ).toBe(scoped.id)

    // Fora da vigência e fora do status: não carimba.
    await prisma.sdContract.update({
      where: { id: scoped.id },
      data: { endsAt: new Date('2026-02-01T00:00:00.000Z') },
    })
    expect(
      expectOk(
        await SdContractRepository.findActiveForCustomer(
          workspace.id,
          customer.id,
          'INCIDENT',
          at,
        ),
      ),
    ).toBeNull()
    await prisma.sdContract.update({
      where: { id: scoped.id },
      data: { endsAt: null, status: 'SUSPENDED' },
    })
    expect(
      expectOk(
        await SdContractRepository.findActiveForCustomer(
          workspace.id,
          customer.id,
          'INCIDENT',
          at,
        ),
      ),
    ).toBeNull()
  })

  it('detects overlapping active contracts of the same customer', async () => {
    const { workspace, user, customer, other } = await setup()
    const open = await seedSdContract(workspace.id, customer.id, user.id, {
      name: 'Aberto',
      startsAt: JAN,
      endsAt: null,
    })

    expect(
      expectOk(
        await SdContractRepository.findOverlapping({
          workspaceId: workspace.id,
          customerId: customer.id,
          startsAt: JUL,
          endsAt: null,
        }),
      )?.id,
    ).toBe(open.id)

    // Outro cliente e o próprio contrato não contam.
    expect(
      expectOk(
        await SdContractRepository.findOverlapping({
          workspaceId: workspace.id,
          customerId: other.id,
          startsAt: JUL,
          endsAt: null,
        }),
      ),
    ).toBeNull()
    expect(
      expectOk(
        await SdContractRepository.findOverlapping({
          workspaceId: workspace.id,
          customerId: customer.id,
          startsAt: JUL,
          endsAt: null,
          excludeId: open.id,
        }),
      ),
    ).toBeNull()

    // Janela que termina antes do início do existente não sobrepõe.
    await prisma.sdContract.update({
      where: { id: open.id },
      data: { startsAt: JUL },
    })
    expect(
      expectOk(
        await SdContractRepository.findOverlapping({
          workspaceId: workspace.id,
          customerId: customer.id,
          startsAt: JAN,
          endsAt: new Date('2026-02-01T00:00:00.000Z'),
        }),
      ),
    ).toBeNull()
  })

  it('validates refs and reports what is missing', async () => {
    const { workspace, customer } = await setup()
    const priority = await seedSdPriority(workspace.id)
    const policy = await seedSdSlaPolicy(workspace.id)

    expect(
      expectOk(
        await SdContractRepository.validateRefs(workspace.id, {
          customerId: customer.id,
          slaPolicyId: policy.id,
          priorityIds: [priority.id, priority.id],
        }),
      ),
    ).toEqual([])
    expect(
      expectOk(
        await SdContractRepository.validateRefs(workspace.id, {
          customerId: 'nope',
        }),
      ),
    ).toEqual(['customerId'])
    expect(
      expectOk(
        await SdContractRepository.validateRefs(workspace.id, {
          slaPolicyId: 'nope',
        }),
      ),
    ).toEqual(['slaPolicyId'])
    expect(
      expectOk(
        await SdContractRepository.validateRefs(workspace.id, {
          priorityIds: ['nope'],
        }),
      ),
    ).toEqual(['priorityId'])
    expect(
      expectOk(await SdContractRepository.validateRefs(workspace.id, {})),
    ).toEqual([])
  })

  it('takes the calendar from the SLA policy, falling back to the default', async () => {
    const { workspace, user, customer } = await setup()
    const standard = await seedSdCalendar(workspace.id, {
      name: 'Padrão',
      isDefault: true,
      timezone: 'America/Sao_Paulo',
    })
    const special = await seedSdCalendar(workspace.id, {
      name: '24x7',
      is24x7: true,
      timezone: 'UTC',
    })
    const policy = await seedSdSlaPolicy(workspace.id, {
      calendarId: special.id,
    })
    await seedSdContract(workspace.id, customer.id, user.id)

    expect(
      expectOk(
        await SdContractRepository.findBillingCalendar(workspace.id, policy.id),
      )?.is24x7,
    ).toBe(true)
    expect(
      expectOk(
        await SdContractRepository.findBillingCalendar(workspace.id, null),
      )?.timezone,
    ).toBe(standard.timezone)
    // Política de outro workspace cai no padrão.
    const stranger = await seedWorkspace()
    expect(
      expectOk(
        await SdContractRepository.findBillingCalendar(stranger.id, policy.id),
      ),
    ).toBeNull()
  })

  it('lists every active contract for the billing tick', async () => {
    const { workspace, user, customer, other } = await setup()
    await seedSdContract(workspace.id, customer.id, user.id, { name: 'Ativo' })
    await seedSdContract(workspace.id, other.id, user.id, {
      name: 'Rascunho',
      status: 'DRAFT',
    })
    const rows = expectOk(await SdContractRepository.listActiveForBilling())
    expect(rows.map((row) => row.name)).toEqual(['Ativo'])
  })

  it('maps failures to DATABASE_ERROR', async () => {
    const many = vi
      .spyOn(prisma.sdContract, 'findMany')
      .mockRejectedValue(new Error('boom'))
    const first = vi
      .spyOn(prisma.sdContract, 'findFirst')
      .mockRejectedValue(new Error('boom'))
    const customerFirst = vi
      .spyOn(prisma.sdCustomer, 'findFirst')
      .mockRejectedValueOnce(new Error('boom'))
    const calendarFirst = vi
      .spyOn(prisma.sdBusinessCalendar, 'findFirst')
      .mockRejectedValueOnce(new Error('boom'))

    expectErr(await SdContractRepository.list('ws'), 'DATABASE_ERROR')
    expectErr(
      await SdContractRepository.listActiveForBilling(),
      'DATABASE_ERROR',
    )
    expectErr(await SdContractRepository.findById('a', 'ws'), 'DATABASE_ERROR')
    expectErr(
      await SdContractRepository.findByIdUnscoped('a'),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdContractRepository.findActiveForCustomer(
        'ws',
        'c',
        'INCIDENT',
        new Date(),
      ),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdContractRepository.findOverlapping({
        workspaceId: 'ws',
        customerId: 'c',
        startsAt: JAN,
        endsAt: null,
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdContractRepository.validateRefs('ws', { customerId: 'c' }),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdContractRepository.findBillingCalendar('ws', null),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdContractRepository.create(
        'missing',
        'missing',
        {
          customerId: 'missing',
          name: 'x',
          startsAt: JAN,
        },
        [],
      ),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdContractRepository.update('missing', { name: 'x' }),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdContractRepository.softDelete('missing'),
      'DATABASE_ERROR',
    )

    many.mockRestore()
    first.mockRestore()
    customerFirst.mockRestore()
    calendarFirst.mockRestore()
  })
})
