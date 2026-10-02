import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeSdContract,
  createFakeSdContractPeriod,
  createFakeSdContractRate,
} from '@/src/__tests__/factories/sd-contract.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/sd-contract.repository')
vi.mock('@/src/repositories/sd-contract-period.repository')
vi.mock('@/src/repositories/sd-time-entry.repository')
vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { SdContractRepository } from '@/src/repositories/sd-contract.repository'
import { SdContractPeriodRepository } from '@/src/repositories/sd-contract-period.repository'
import { SdTimeEntryRepository } from '@/src/repositories/sd-time-entry.repository'
import { SdContractBillingService } from '../sd-contract-billing.service'

const contracts = vi.mocked(SdContractRepository)
const periods = vi.mocked(SdContractPeriodRepository)
const entries = vi.mocked(SdTimeEntryRepository)

const OCT = new Date('2026-10-01T00:00:00.000Z')
const NOV = new Date('2026-11-01T00:00:00.000Z')
const MID_OCT = new Date('2026-10-15T12:00:00.000Z')

function periodEntry(
  minutes: number,
  billable = true,
  window: 'BUSINESS_HOURS' | 'AFTER_HOURS' = 'BUSINESS_HOURS',
) {
  return {
    id: `e${minutes}-${window}`,
    minutes,
    billable,
    window,
    startedAt: MID_OCT,
    ticket: { type: 'INCIDENT' as const, priorityId: 'p1' },
  }
}

beforeEach(() => {
  contracts.listActiveForBilling.mockResolvedValue(ok([]))
  periods.findByStart.mockResolvedValue(ok(null))
  periods.findPrevious.mockResolvedValue(ok(null))
  periods.listOverdueOpen.mockResolvedValue(ok([]))
  periods.ensure.mockImplementation(async (data) =>
    ok(
      createFakeSdContractPeriod({
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        includedMinutes: data.includedMinutes,
      }),
    ),
  )
  periods.update.mockImplementation(async (_id, data) =>
    ok(
      createFakeSdContractPeriod({
        usedMinutes: data.usedMinutes ?? 0,
        billableMinutes: data.billableMinutes ?? 0,
        overageMinutes: data.overageMinutes ?? 0,
        carriedMinutes: data.carriedMinutes ?? 0,
        amount: new Prisma.Decimal(data.amount ?? '0'),
        status: data.status ?? 'OPEN',
      }),
    ),
  )
  entries.listForPeriod.mockResolvedValue(ok([]))
  entries.linkPeriod.mockResolvedValue(ok(0))
})

describe('ensureOpenPeriod', () => {
  it('abre o período do ciclo com a franquia do contrato', async () => {
    const period = expectOk(
      await SdContractBillingService.ensureOpenPeriod(
        createFakeSdContract(),
        MID_OCT,
      ),
    )
    expect(periods.ensure).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      contractId: 'ct1',
      periodStart: OCT,
      periodEnd: NOV,
      includedMinutes: 1200,
    })
    expect(period.includedMinutes).toBe(1200)
  })

  it('soma o saldo acumulado do período anterior quando o contrato acumula', async () => {
    periods.findPrevious.mockResolvedValue(
      ok(createFakeSdContractPeriod({ carriedMinutes: 300 })),
    )
    expectOk(
      await SdContractBillingService.ensureOpenPeriod(
        createFakeSdContract({ carryOver: true }),
        MID_OCT,
      ),
    )
    expect(periods.ensure.mock.calls[0][0].includedMinutes).toBe(1500)
  })

  it('sem período anterior o saldo acumulado é zero', async () => {
    periods.findPrevious.mockResolvedValue(ok(null))
    expectOk(
      await SdContractBillingService.ensureOpenPeriod(
        createFakeSdContract({ carryOver: true, includedMinutes: 600 }),
        MID_OCT,
      ),
    )
    expect(periods.ensure.mock.calls[0][0].includedMinutes).toBe(600)
  })

  it('não consulta o anterior quando o contrato não acumula', async () => {
    expectOk(
      await SdContractBillingService.ensureOpenPeriod(
        createFakeSdContract({ carryOver: false }),
        MID_OCT,
      ),
    )
    expect(periods.findPrevious).not.toHaveBeenCalled()
  })

  it('devolve o período já aberto sem recriar', async () => {
    periods.findByStart.mockResolvedValue(
      ok(createFakeSdContractPeriod({ includedMinutes: 999 })),
    )
    const period = expectOk(
      await SdContractBillingService.ensureOpenPeriod(
        createFakeSdContract(),
        MID_OCT,
      ),
    )
    expect(period.includedMinutes).toBe(999)
    expect(periods.ensure).not.toHaveBeenCalled()
  })

  it('recusa quando o período já foi fechado', async () => {
    periods.findByStart.mockResolvedValue(
      ok(createFakeSdContractPeriod({ status: 'CLOSED' })),
    )
    expectErr(
      await SdContractBillingService.ensureOpenPeriod(
        createFakeSdContract(),
        MID_OCT,
      ),
      'SD_CONTRACT_PERIOD_CLOSED',
    )
  })

  it('propaga erro de banco da busca, do anterior e da criação', async () => {
    periods.findByStart.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdContractBillingService.ensureOpenPeriod(
        createFakeSdContract(),
        MID_OCT,
      ),
      'DATABASE_ERROR',
    )

    periods.findByStart.mockResolvedValue(ok(null))
    periods.findPrevious.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdContractBillingService.ensureOpenPeriod(
        createFakeSdContract({ carryOver: true }),
        MID_OCT,
      ),
      'DATABASE_ERROR',
    )

    periods.ensure.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdContractBillingService.ensureOpenPeriod(
        createFakeSdContract(),
        MID_OCT,
      ),
      'DATABASE_ERROR',
    )
  })
})

describe('consolidate', () => {
  it('soma os apontamentos, cobra o excedente e vincula ao período', async () => {
    entries.listForPeriod.mockResolvedValue(
      ok([periodEntry(600), periodEntry(300), periodEntry(120, false)]),
    )
    entries.linkPeriod.mockResolvedValue(ok(3))
    const period = expectOk(
      await SdContractBillingService.consolidate(
        createFakeSdContract({ includedMinutes: 1200 }),
        createFakeSdContractPeriod({ includedMinutes: 600 }),
      ),
    )
    // 900 min faturáveis, 600 de franquia → 300 de excedente a R$ 200/h.
    expect(period.usedMinutes).toBe(1020)
    expect(period.billableMinutes).toBe(900)
    expect(period.overageMinutes).toBe(300)
    expect(period.amount.toFixed(2)).toBe('1000.00')
    expect(entries.linkPeriod).toHaveBeenCalledWith(
      expect.arrayContaining(['e600-BUSINESS_HOURS']),
      'per1',
    )
    expect(periods.update.mock.calls[0][1].status).toBeUndefined()
  })

  it('usa a regra de valor da janela quando existe', async () => {
    entries.listForPeriod.mockResolvedValue(
      ok([periodEntry(60, true, 'AFTER_HOURS')]),
    )
    const period = expectOk(
      await SdContractBillingService.consolidate(
        createFakeSdContract({
          rates: [
            createFakeSdContractRate({
              window: 'AFTER_HOURS',
              hourlyRate: new Prisma.Decimal('300.00'),
              multiplier: new Prisma.Decimal('1.50'),
            }),
          ],
        }),
        createFakeSdContractPeriod({ includedMinutes: 0 }),
      ),
    )
    expect(period.amount.toFixed(2)).toBe('450.00')
  })

  it('fecha o período quando pedido, carimbando quem fechou', async () => {
    expectOk(
      await SdContractBillingService.consolidate(
        createFakeSdContract(),
        createFakeSdContractPeriod(),
        { close: true, closedById: 'admin-1' },
      ),
    )
    const data = periods.update.mock.calls[0][1]
    expect(data.status).toBe('CLOSED')
    expect(data.closedById).toBe('admin-1')
    expect(data.closedAt).toBeInstanceOf(Date)
  })

  it('fechamento automático não tem autor', async () => {
    expectOk(
      await SdContractBillingService.consolidate(
        createFakeSdContract(),
        createFakeSdContractPeriod(),
        { close: true },
      ),
    )
    expect(periods.update.mock.calls[0][1].closedById).toBeNull()
  })

  it('propaga erro de banco dos apontamentos, do vínculo e da gravação', async () => {
    entries.listForPeriod.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdContractBillingService.consolidate(
        createFakeSdContract(),
        createFakeSdContractPeriod(),
      ),
      'DATABASE_ERROR',
    )

    entries.listForPeriod.mockResolvedValue(ok([periodEntry(60)]))
    entries.linkPeriod.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdContractBillingService.consolidate(
        createFakeSdContract(),
        createFakeSdContractPeriod(),
      ),
      'DATABASE_ERROR',
    )

    entries.linkPeriod.mockResolvedValue(ok(1))
    periods.update.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdContractBillingService.consolidate(
        createFakeSdContract(),
        createFakeSdContractPeriod(),
      ),
      'DATABASE_ERROR',
    )
  })
})

describe('runTick', () => {
  it('sem contrato ativo não faz nada', async () => {
    const result = expectOk(await SdContractBillingService.runTick(MID_OCT))
    expect(result).toEqual({ contracts: 0, opened: 0, closed: 0 })
  })

  it('abre o período novo e fecha o anterior vencido', async () => {
    contracts.listActiveForBilling.mockResolvedValue(
      ok([createFakeSdContract()]),
    )
    periods.listOverdueOpen.mockResolvedValue(
      ok([
        createFakeSdContractPeriod({
          id: 'per-set',
          periodStart: new Date('2026-09-01T00:00:00.000Z'),
          periodEnd: OCT,
        }),
      ]),
    )
    const result = expectOk(await SdContractBillingService.runTick(MID_OCT))
    expect(result).toEqual({ contracts: 1, opened: 1, closed: 1 })
    expect(periods.update.mock.calls[0][1].status).toBe('CLOSED')
  })

  it('período já aberto não conta como aberto agora', async () => {
    contracts.listActiveForBilling.mockResolvedValue(
      ok([createFakeSdContract()]),
    )
    periods.findByStart.mockResolvedValue(ok(createFakeSdContractPeriod()))
    const result = expectOk(await SdContractBillingService.runTick(MID_OCT))
    expect(result.opened).toBe(0)
  })

  it('falha de abertura e de consolidação não derruba o tick', async () => {
    contracts.listActiveForBilling.mockResolvedValue(
      ok([createFakeSdContract()]),
    )
    periods.ensure.mockResolvedValue(err(databaseError()))
    periods.listOverdueOpen.mockResolvedValue(
      ok([createFakeSdContractPeriod({ id: 'per-set' })]),
    )
    periods.update.mockResolvedValue(err(databaseError()))
    const result = expectOk(await SdContractBillingService.runTick(MID_OCT))
    expect(result).toEqual({ contracts: 1, opened: 0, closed: 0 })
  })

  it('falha ao listar os vencidos pula para o contrato seguinte', async () => {
    contracts.listActiveForBilling.mockResolvedValue(
      ok([createFakeSdContract(), createFakeSdContract({ id: 'ct2' })]),
    )
    periods.listOverdueOpen.mockResolvedValue(err(databaseError()))
    const result = expectOk(await SdContractBillingService.runTick(MID_OCT))
    expect(result).toEqual({ contracts: 2, opened: 2, closed: 0 })
  })

  it('propaga erro de banco da lista de contratos', async () => {
    contracts.listActiveForBilling.mockResolvedValue(err(databaseError()))
    expectErr(await SdContractBillingService.runTick(MID_OCT), 'DATABASE_ERROR')
  })

  it('usa a data corrente quando nenhuma é informada', async () => {
    expectOk(await SdContractBillingService.runTick())
    expect(contracts.listActiveForBilling).toHaveBeenCalled()
  })
})
