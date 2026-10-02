import { describe, expect, it, vi } from 'vitest'
import {
  seedSdContract,
  seedSdContractPeriod,
} from '@/src/__tests__/factories/sd-contract.factory'
import { seedSdCustomer } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdContractPeriodRepository } from '../sd-contract-period.repository'

const SEP = new Date('2026-09-01T00:00:00.000Z')
const OCT = new Date('2026-10-01T00:00:00.000Z')
const NOV = new Date('2026-11-01T00:00:00.000Z')

async function setup() {
  const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
  const customer = await seedSdCustomer(workspace.id, user.id)
  const contract = await seedSdContract(workspace.id, customer.id, user.id)
  return { workspace, user, contract }
}

describe('SdContractPeriodRepository', () => {
  it('opens a period once and reopening returns the same row', async () => {
    const { workspace, contract } = await setup()
    const data = {
      workspaceId: workspace.id,
      contractId: contract.id,
      periodStart: OCT,
      periodEnd: NOV,
      includedMinutes: 600,
    }
    const first = expectOk(await SdContractPeriodRepository.ensure(data))
    const again = expectOk(
      await SdContractPeriodRepository.ensure({
        ...data,
        includedMinutes: 999,
      }),
    )
    expect(again.id).toBe(first.id)
    expect(again.includedMinutes).toBe(600)
    expect(
      expectOk(await SdContractPeriodRepository.findByStart(contract.id, OCT))
        ?.id,
    ).toBe(first.id)
    expect(
      expectOk(await SdContractPeriodRepository.findByStart(contract.id, SEP)),
    ).toBeNull()
  })

  it('lists newest first, finds by id and scopes by contract', async () => {
    const { workspace, user, contract } = await setup()
    const other = await seedSdContract(
      workspace.id,
      contract.customerId,
      user.id,
      { name: 'Outro', status: 'DRAFT' },
    )
    const september = await seedSdContractPeriod(workspace.id, contract.id, {
      periodStart: SEP,
      periodEnd: OCT,
    })
    const october = await seedSdContractPeriod(workspace.id, contract.id, {
      periodStart: OCT,
      periodEnd: NOV,
    })

    const rows = expectOk(
      await SdContractPeriodRepository.listByContract(contract.id),
    )
    expect(rows.map((row) => row.id)).toEqual([october.id, september.id])
    expect(
      expectOk(
        await SdContractPeriodRepository.findById(october.id, contract.id),
      ).id,
    ).toBe(october.id)
    expectErr(
      await SdContractPeriodRepository.findById(october.id, other.id),
      'SD_CONTRACT_PERIOD_NOT_FOUND',
    )
  })

  it('finds the previous period for the carried balance', async () => {
    const { workspace, contract } = await setup()
    const september = await seedSdContractPeriod(workspace.id, contract.id, {
      periodStart: SEP,
      periodEnd: OCT,
      carriedMinutes: 120,
    })
    await seedSdContractPeriod(workspace.id, contract.id, {
      periodStart: OCT,
      periodEnd: NOV,
    })

    expect(
      expectOk(await SdContractPeriodRepository.findPrevious(contract.id, OCT))
        ?.carriedMinutes,
    ).toBe(120)
    expect(
      expectOk(await SdContractPeriodRepository.findPrevious(contract.id, SEP)),
    ).toBeNull()
    expect(
      expectOk(await SdContractPeriodRepository.findPrevious(contract.id, NOV))
        ?.id,
    ).not.toBe(september.id)
  })

  it('lists only overdue open periods and reports the closed ones', async () => {
    const { workspace, contract } = await setup()
    const overdue = await seedSdContractPeriod(workspace.id, contract.id, {
      periodStart: SEP,
      periodEnd: OCT,
    })
    const current = await seedSdContractPeriod(workspace.id, contract.id, {
      periodStart: OCT,
      periodEnd: NOV,
    })
    const closed = await seedSdContractPeriod(workspace.id, contract.id, {
      periodStart: new Date('2026-08-01T00:00:00.000Z'),
      periodEnd: SEP,
      status: 'CLOSED',
    })

    const rows = expectOk(
      await SdContractPeriodRepository.listOverdueOpen(
        contract.id,
        new Date('2026-10-15T00:00:00.000Z'),
      ),
    )
    expect(rows.map((row) => row.id)).toEqual([overdue.id])

    expect([
      ...expectOk(
        await SdContractPeriodRepository.findClosedIds([current.id, closed.id]),
      ),
    ]).toEqual([closed.id])
    expect(
      expectOk(await SdContractPeriodRepository.findClosedIds([])).size,
    ).toBe(0)
  })

  it('updates the totals and closes the period', async () => {
    const { workspace, user, contract } = await setup()
    const period = await seedSdContractPeriod(workspace.id, contract.id)

    const closed = expectOk(
      await SdContractPeriodRepository.update(period.id, {
        usedMinutes: 700,
        billableMinutes: 700,
        overageMinutes: 100,
        carriedMinutes: 0,
        amount: '250.00',
        status: 'CLOSED',
        closedAt: new Date('2026-11-01T03:00:00.000Z'),
        closedById: user.id,
      }),
    )
    expect(closed.status).toBe('CLOSED')
    expect(closed.amount.toFixed(2)).toBe('250.00')
    expect(closed.closedBy?.id).toBe(user.id)
  })

  it('maps failures to DATABASE_ERROR', async () => {
    const many = vi
      .spyOn(prisma.sdContractPeriod, 'findMany')
      .mockRejectedValue(new Error('boom'))
    const first = vi
      .spyOn(prisma.sdContractPeriod, 'findFirst')
      .mockRejectedValue(new Error('boom'))
    const unique = vi
      .spyOn(prisma.sdContractPeriod, 'findUnique')
      .mockRejectedValueOnce(new Error('boom'))

    expectErr(
      await SdContractPeriodRepository.listByContract('c'),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdContractPeriodRepository.findById('p', 'c'),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdContractPeriodRepository.findByStart('c', OCT),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdContractPeriodRepository.findPrevious('c', OCT),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdContractPeriodRepository.listOverdueOpen('c', OCT),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdContractPeriodRepository.findClosedIds(['p']),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdContractPeriodRepository.ensure({
        workspaceId: 'missing',
        contractId: 'missing',
        periodStart: OCT,
        periodEnd: NOV,
        includedMinutes: 0,
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdContractPeriodRepository.update('missing', { usedMinutes: 1 }),
      'DATABASE_ERROR',
    )

    many.mockRestore()
    first.mockRestore()
    unique.mockRestore()
  })
})
