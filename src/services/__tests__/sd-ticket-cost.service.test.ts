import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSdTicketCost } from '@/src/__tests__/factories/sd-ticket-tabs.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { sdTabScope } from '@/src/__tests__/helpers/sd-ticket-tab.helpers'
import { databaseError, sdNotAgent } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { CreateSdTicketCostSchema } from '@/src/schemas/sd-ticket-cost.schema'

vi.mock('@/lib/axiom/audit')
vi.mock('@/src/repositories/sd-ticket-cost.repository')
vi.mock('@/src/repositories/sd-ticket-context.repository')
vi.mock('../sd-ticket-tab-support', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-ticket-tab-support')>()),
  loadSdTicketTab: vi.fn(),
  publishSdTicketTab: vi.fn(),
}))
vi.mock('../sd-ticket-engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-ticket-engine')>()),
  SdTicketEngine: { touchActivity: vi.fn() },
}))
vi.mock('../sd-ticket-event-recorder', () => ({ recordSdTicketEvent: vi.fn() }))

import { auditMutation } from '@/lib/axiom/audit'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { SdTicketCostRepository } from '@/src/repositories/sd-ticket-cost.repository'
import { SdTicketCostService } from '../sd-ticket-cost.service'
import { SdTicketEngine } from '../sd-ticket-engine'
import { recordSdTicketEvent } from '../sd-ticket-event-recorder'
import { loadSdTicketTab, publishSdTicketTab } from '../sd-ticket-tab-support'

const load = vi.mocked(loadSdTicketTab)
const repo = vi.mocked(SdTicketCostRepository)
const ctxRepo = vi.mocked(SdTicketContextRepository)
const record = vi.mocked(recordSdTicketEvent)

const input = CreateSdTicketCostSchema.parse({
  category: 'LABOR',
  description: 'Hora técnica',
  quantity: '1,5',
  unitCost: '120',
  billable: true,
  userId: 'tech',
})

beforeEach(() => {
  load.mockResolvedValue(ok(sdTabScope()))
  ctxRepo.findNonMembers.mockResolvedValue(ok([]))
  repo.create.mockImplementation(async (data) =>
    ok(
      createFakeSdTicketCost({
        id: 'c1',
        category: data.category,
        description: data.description,
        quantity: new Prisma.Decimal(data.quantity ?? '1'),
        unitCost: new Prisma.Decimal(data.unitCost),
        billable: data.billable,
      }),
    ),
  )
  repo.findById.mockResolvedValue(ok(createFakeSdTicketCost({ id: 'c1' })))
  repo.update.mockResolvedValue(
    ok(
      createFakeSdTicketCost({
        id: 'c1',
        quantity: new Prisma.Decimal('3'),
      }),
    ),
  )
  repo.delete.mockResolvedValue(ok(undefined))
})

describe('list', () => {
  it('returns items and totals', async () => {
    repo.list.mockResolvedValue(
      ok([
        createFakeSdTicketCost({ billable: true }),
        createFakeSdTicketCost({
          category: 'TRAVEL',
          billable: false,
          quantity: new Prisma.Decimal('1'),
          unitCost: new Prisma.Decimal('50.5'),
        }),
      ]),
    )
    const out = expectOk(await SdTicketCostService.list('u1', 'ws1', 't1'))
    expect(out.summary).toEqual({
      total: '250.50',
      billable: '200.00',
      nonBillable: '50.50',
      byCategory: [
        { category: 'LABOR', total: '200.00' },
        { category: 'TRAVEL', total: '50.50' },
      ],
    })
    expect(load).toHaveBeenCalledWith('u1', 'ws1', 't1', 'VIEW', {
      agentOnly: true,
    })
  })

  it('propagates errors', async () => {
    load.mockResolvedValueOnce(err(sdNotAgent()))
    expectErr(await SdTicketCostService.list('r', 'ws1', 't1'), 'SD_NOT_AGENT')
    repo.list.mockResolvedValue(err(databaseError()))
    expectErr(await SdTicketCostService.list('u1', 'ws1', 't1'))
  })
})

describe('create', () => {
  it('stores the decimal cost and records the total', async () => {
    const dto = expectOk(
      await SdTicketCostService.create('u1', 'ws1', 't1', input),
    )
    expect(dto.total).toBe('180.00')
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: '1.50',
        unitCost: '120.00',
        userId: 'tech',
        createdById: 'u1',
      }),
    )
    expect(ctxRepo.findNonMembers).toHaveBeenCalledWith('ws1', ['tech'])
    expect(SdTicketEngine.touchActivity).toHaveBeenCalledWith('t1')
    expect(record.mock.calls[0]?.[0]).toMatchObject({
      action: 'cost.added',
      meta: { total: '180.00', billable: true, category: 'LABOR' },
    })
    expect(publishSdTicketTab).toHaveBeenCalledWith(
      expect.anything(),
      'ticket.cost',
      'u1',
      true,
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'sd_ticket_cost', action: 'create' }),
    )
  })

  it('works without a technician', async () => {
    expectOk(
      await SdTicketCostService.create('u1', 'ws1', 't1', {
        ...input,
        userId: undefined,
      }),
    )
    expect(repo.create.mock.calls[0]?.[0].userId).toBeNull()
    expect(ctxRepo.findNonMembers).not.toHaveBeenCalled()
  })

  it('rejects outsiders and propagates errors', async () => {
    ctxRepo.findNonMembers.mockResolvedValueOnce(ok(['tech']))
    expectErr(
      await SdTicketCostService.create('u1', 'ws1', 't1', input),
      'VALIDATION_ERROR',
    )
    ctxRepo.findNonMembers.mockResolvedValueOnce(err(databaseError()))
    expectErr(await SdTicketCostService.create('u1', 'ws1', 't1', input))
    repo.create.mockResolvedValueOnce(err(databaseError()))
    expectErr(await SdTicketCostService.create('u1', 'ws1', 't1', input))
    load.mockResolvedValueOnce(err(sdNotAgent()))
    expectErr(
      await SdTicketCostService.create('r', 'ws1', 't1', input),
      'SD_NOT_AGENT',
    )
  })
})

describe('update', () => {
  it('updates and records before/after totals', async () => {
    const dto = expectOk(
      await SdTicketCostService.update('u1', 'ws1', 't1', 'c1', {
        quantity: '3.00',
      }),
    )
    expect(dto.total).toBe('300.00')
    expect(repo.findById).toHaveBeenCalledWith('c1', 't1')
    expect(record.mock.calls[0]?.[0]).toMatchObject({
      action: 'cost.updated',
      meta: { before: '200.00', after: '300.00', fields: ['quantity'] },
    })
  })

  it('propagates errors', async () => {
    load.mockResolvedValueOnce(err(sdNotAgent()))
    expectErr(
      await SdTicketCostService.update('r', 'ws1', 't1', 'c1', {
        billable: true,
      }),
    )
    repo.findById.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketCostService.update('u1', 'ws1', 't1', 'c1', {
        billable: true,
      }),
    )
    ctxRepo.findNonMembers.mockResolvedValueOnce(ok(['x']))
    expectErr(
      await SdTicketCostService.update('u1', 'ws1', 't1', 'c1', {
        userId: 'x',
      }),
      'VALIDATION_ERROR',
    )
    repo.update.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketCostService.update('u1', 'ws1', 't1', 'c1', {
        billable: true,
      }),
      'DATABASE_ERROR',
    )
  })
})

describe('remove', () => {
  it('deletes (DELETE permission) and records the removed total', async () => {
    expectOk(await SdTicketCostService.remove('u1', 'ws1', 't1', 'c1'))
    expect(load).toHaveBeenCalledWith('u1', 'ws1', 't1', 'DELETE', {
      agentOnly: true,
      requireOpen: true,
    })
    expect(repo.delete).toHaveBeenCalledWith('c1')
    expect(record.mock.calls[0]?.[0]).toMatchObject({
      action: 'cost.removed',
      meta: { total: '200.00' },
    })
  })

  it('propagates errors', async () => {
    load.mockResolvedValueOnce(err(sdNotAgent()))
    expectErr(await SdTicketCostService.remove('r', 'ws1', 't1', 'c1'))
    repo.findById.mockResolvedValueOnce(err(databaseError()))
    expectErr(await SdTicketCostService.remove('u1', 'ws1', 't1', 'c1'))
    repo.delete.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketCostService.remove('u1', 'ws1', 't1', 'c1'),
      'DATABASE_ERROR',
    )
  })
})
