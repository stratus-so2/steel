import { describe, expect, it } from 'vitest'
import {
  CloseSdContractPeriodSchema,
  CreateSdContractSchema,
  ListSdContractsSchema,
  SdContractRateInputSchema,
  SdMultiplierSchema,
  UpdateSdContractSchema,
} from '../sd-contract.schema'

const base = {
  customerId: 'cus_1',
  name: 'Suporte mensal 20 h',
  startsAt: '2026-10-01T00:00:00.000Z',
}

describe('CreateSdContractSchema', () => {
  it('aplica os padrões do contrato', () => {
    const parsed = CreateSdContractSchema.parse(base)
    expect(parsed.status).toBe('DRAFT')
    expect(parsed.billingCycle).toBe('MONTHLY')
    expect(parsed.includedMinutes).toBe(0)
    expect(parsed.carryOver).toBe(false)
    expect(parsed.hourlyRate).toBe('0.00')
    expect(parsed.roundingMinutes).toBe(1)
    expect(parsed.minimumMinutes).toBe(0)
    expect(parsed.ticketTypes).toEqual([])
    expect(parsed.rates).toEqual([])
    expect(parsed.startsAt).toBeInstanceOf(Date)
  })

  it('normaliza dinheiro com vírgula', () => {
    const parsed = CreateSdContractSchema.parse({
      ...base,
      hourlyRate: '150,5',
      overtimeRate: 200,
    })
    expect(parsed.hourlyRate).toBe('150.50')
    expect(parsed.overtimeRate).toBe('200.00')
  })

  it('aceita término nulo e recusa término antes do início', () => {
    expect(
      CreateSdContractSchema.parse({ ...base, endsAt: null }).endsAt,
    ).toBeNull()
    const bad = CreateSdContractSchema.safeParse({
      ...base,
      endsAt: '2026-09-01T00:00:00.000Z',
    })
    expect(bad.success).toBe(false)
    expect(bad.error?.issues[0].path).toEqual(['endsAt'])
  })

  it('recusa arredondamento e mínimo fora do intervalo', () => {
    expect(
      CreateSdContractSchema.safeParse({ ...base, roundingMinutes: 0 }).success,
    ).toBe(false)
    expect(
      CreateSdContractSchema.safeParse({ ...base, minimumMinutes: 2000 })
        .success,
    ).toBe(false)
  })

  it('recusa mais de quatro tipos cobertos', () => {
    expect(
      CreateSdContractSchema.safeParse({
        ...base,
        ticketTypes: ['INCIDENT', 'CHANGE', 'PROBLEM', 'SERVICE_REQUEST'],
      }).success,
    ).toBe(true)
    expect(
      CreateSdContractSchema.safeParse({ ...base, ticketTypes: ['OUTRO'] })
        .success,
    ).toBe(false)
  })

  it('valida as regras de valor junto', () => {
    const parsed = CreateSdContractSchema.parse({
      ...base,
      rates: [{ hourlyRate: '180,00', window: 'AFTER_HOURS', multiplier: 1.5 }],
    })
    expect(parsed.rates[0]).toEqual({
      ticketType: null,
      priorityId: null,
      window: 'AFTER_HOURS',
      hourlyRate: '180.00',
      multiplier: '1.50',
    })
  })
})

describe('SdContractRateInputSchema', () => {
  it('exige o valor da hora', () => {
    expect(SdContractRateInputSchema.safeParse({}).success).toBe(false)
  })

  it('usa curinga e janela comercial por padrão', () => {
    const parsed = SdContractRateInputSchema.parse({ hourlyRate: 100 })
    expect(parsed.ticketType).toBeNull()
    expect(parsed.priorityId).toBeNull()
    expect(parsed.window).toBe('BUSINESS_HOURS')
    expect(parsed.multiplier).toBe('1.00')
  })
})

describe('SdMultiplierSchema', () => {
  it('aceita número e string com vírgula', () => {
    expect(SdMultiplierSchema.parse(2)).toBe('2.00')
    expect(SdMultiplierSchema.parse('1,75')).toBe('1.75')
  })

  it('recusa zero, negativo, exagerado e texto', () => {
    for (const value of [0, -1, 100, 'x']) {
      expect(SdMultiplierSchema.safeParse(value).success).toBe(false)
    }
  })
})

describe('UpdateSdContractSchema', () => {
  it('exige ao menos um campo', () => {
    expect(UpdateSdContractSchema.safeParse({}).success).toBe(false)
  })

  it('aceita um campo só', () => {
    expect(UpdateSdContractSchema.parse({ status: 'ACTIVE' }).status).toBe(
      'ACTIVE',
    )
  })

  it('valida a coerência das datas quando as duas vêm', () => {
    expect(
      UpdateSdContractSchema.safeParse({
        startsAt: '2026-10-01T00:00:00.000Z',
        endsAt: '2026-09-01T00:00:00.000Z',
      }).success,
    ).toBe(false)
    expect(
      UpdateSdContractSchema.safeParse({ endsAt: '2026-09-01T00:00:00.000Z' })
        .success,
    ).toBe(true)
  })

  it('substitui a tabela de valores quando `rates` vem', () => {
    expect(UpdateSdContractSchema.parse({ rates: [] }).rates).toEqual([])
  })
})

describe('ListSdContractsSchema', () => {
  it('trata vazio e nulo como ausente', () => {
    const parsed = ListSdContractsSchema.parse({
      customerId: '',
      status: null,
      q: '',
    })
    expect(parsed).toEqual({})
  })

  it('aceita os filtros', () => {
    expect(
      ListSdContractsSchema.parse({
        customerId: 'c1',
        status: 'ACTIVE',
        q: ' x ',
      }),
    ).toEqual({ customerId: 'c1', status: 'ACTIVE', q: 'x' })
  })
})

describe('CloseSdContractPeriodSchema', () => {
  it('período opcional', () => {
    expect(CloseSdContractPeriodSchema.parse({})).toEqual({})
    expect(CloseSdContractPeriodSchema.parse({ periodId: 'p1' })).toEqual({
      periodId: 'p1',
    })
  })
})
