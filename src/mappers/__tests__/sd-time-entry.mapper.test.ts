import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import {
  createFakeSdContract,
  createFakeSdContractPeriod,
  createFakeSdTimeEntry,
} from '@/src/__tests__/factories/sd-contract.factory'
import {
  canEditSdTimeEntry,
  sdTimeEntrySummary,
  toSdTimeEntryDTO,
  toSdTimeEntryListDTO,
} from '../sd-time-entry.mapper'

const agent = { userId: 'u1', isAdmin: false }
const admin = { userId: 'u9', isAdmin: true }

describe('canEditSdTimeEntry', () => {
  it('o autor mexe no próprio apontamento', () => {
    expect(canEditSdTimeEntry({ userId: 'u1', periodId: null }, agent)).toBe(
      true,
    )
  })

  it('outro agente não mexe', () => {
    expect(canEditSdTimeEntry({ userId: 'u2', periodId: null }, agent)).toBe(
      false,
    )
  })

  it('admin mexe em qualquer um', () => {
    expect(canEditSdTimeEntry({ userId: 'u2', periodId: null }, admin)).toBe(
      true,
    )
  })

  it('período fechado congela até para o admin', () => {
    const frozen = { ...admin, frozenPeriodIds: new Set(['per1']) }
    expect(canEditSdTimeEntry({ userId: 'u2', periodId: 'per1' }, frozen)).toBe(
      false,
    )
    expect(canEditSdTimeEntry({ userId: 'u2', periodId: 'per2' }, frozen)).toBe(
      true,
    )
  })
})

describe('toSdTimeEntryDTO', () => {
  it('serializa o apontamento fechado', () => {
    const dto = toSdTimeEntryDTO(createFakeSdTimeEntry({ userId: 'u1' }), agent)
    expect(dto.startedAt).toBe('2026-10-07T13:00:00.000Z')
    expect(dto.endedAt).toBe('2026-10-07T14:00:00.000Z')
    expect(dto.minutes).toBe(60)
    expect(dto.amount).toBe('150.00')
    expect(dto.window).toBe('BUSINESS_HOURS')
    expect(dto.editable).toBe(true)
  })

  it('cronômetro em andamento não tem fim nem valor', () => {
    const dto = toSdTimeEntryDTO(
      createFakeSdTimeEntry({
        userId: 'u2',
        endedAt: null,
        minutes: 0,
        amount: null,
        periodId: null,
      }),
      agent,
    )
    expect(dto.endedAt).toBeNull()
    expect(dto.amount).toBeNull()
    expect(dto.editable).toBe(false)
  })
})

describe('sdTimeEntrySummary', () => {
  const entry = (
    minutes: number,
    billable: boolean,
    amount: string | null,
    window: 'BUSINESS_HOURS' | 'AFTER_HOURS' = 'BUSINESS_HOURS',
  ) => ({
    minutes,
    billable,
    window,
    amount: amount === null ? null : new Prisma.Decimal(amount),
    endedAt: new Date('2026-10-07T14:00:00.000Z'),
  })

  it('soma minutos e valor, separando faturável de interno', () => {
    const summary = sdTimeEntrySummary([
      entry(60, true, '150.00'),
      entry(30, false, '75.00'),
      entry(45, true, '202.50', 'AFTER_HOURS'),
    ])
    expect(summary.totalMinutes).toBe(135)
    expect(summary.billableMinutes).toBe(105)
    expect(summary.nonBillableMinutes).toBe(30)
    expect(summary.amount).toBe('427.50')
    expect(summary.byWindow).toEqual([
      { window: 'BUSINESS_HOURS', minutes: 90 },
      { window: 'AFTER_HOURS', minutes: 45 },
    ])
  })

  it('ignora o cronômetro em andamento e valor ausente', () => {
    const summary = sdTimeEntrySummary([
      { ...entry(60, true, null), endedAt: null },
      entry(15, true, null),
    ])
    expect(summary.totalMinutes).toBe(15)
    expect(summary.amount).toBe('0.00')
    expect(summary.byWindow).toEqual([
      { window: 'BUSINESS_HOURS', minutes: 15 },
    ])
  })

  it('lista vazia zera tudo', () => {
    const summary = sdTimeEntrySummary([])
    expect(summary).toEqual({
      totalMinutes: 0,
      billableMinutes: 0,
      nonBillableMinutes: 0,
      amount: '0.00',
      byWindow: [],
    })
  })
})

describe('toSdTimeEntryListDTO', () => {
  it('junta itens, resumo, cronômetro e o contrato do chamado', () => {
    const dto = toSdTimeEntryListDTO({
      rows: [createFakeSdTimeEntry({ userId: 'u1' })],
      running: createFakeSdTimeEntry({ endedAt: null, minutes: 0 }),
      contract: createFakeSdContract(),
      period: createFakeSdContractPeriod({ billableMinutes: 60 }),
      viewer: { ...agent, frozenPeriodIds: new Set<string>() },
    })
    expect(dto.items).toHaveLength(1)
    expect(dto.summary.totalMinutes).toBe(60)
    expect(dto.running?.endedAt).toBeNull()
    expect(dto.contract).toEqual({
      id: 'ct1',
      name: 'Suporte mensal 20 h',
      code: 'CT-001',
      includedMinutes: 1200,
      roundingMinutes: 15,
      minimumMinutes: 30,
      period: expect.objectContaining({ id: 'per1' }),
    })
  })

  it('chamado sem contrato e sem cronômetro', () => {
    const dto = toSdTimeEntryListDTO({
      rows: [],
      running: null,
      contract: null,
      period: null,
      viewer: agent,
    })
    expect(dto.items).toEqual([])
    expect(dto.running).toBeNull()
    expect(dto.contract).toBeNull()
  })

  it('contrato sem período corrente', () => {
    const dto = toSdTimeEntryListDTO({
      rows: [],
      running: null,
      contract: createFakeSdContract(),
      period: null,
      viewer: agent,
    })
    expect(dto.contract?.period).toBeNull()
  })
})
