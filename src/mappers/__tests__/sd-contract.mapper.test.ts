import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import {
  createFakeSdContract,
  createFakeSdContractPeriod,
  createFakeSdContractRate,
} from '@/src/__tests__/factories/sd-contract.factory'
import {
  sdPeriodPercentUsed,
  toSdContractDTO,
  toSdContractPeriodDTO,
  toSdContractRateDTO,
  toSdContractSummaryDTO,
} from '../sd-contract.mapper'

describe('toSdContractRateDTO', () => {
  it('serializa dinheiro e multiplicador com duas casas', () => {
    const dto = toSdContractRateDTO(
      createFakeSdContractRate({
        hourlyRate: new Prisma.Decimal('180.5'),
        multiplier: new Prisma.Decimal('1.5'),
        ticketType: 'CHANGE',
        window: 'HOLIDAY',
        position: 3,
        priority: { id: 'p1', name: 'Crítica' },
        priorityId: 'p1',
      }),
    )
    expect(dto.hourlyRate).toBe('180.50')
    expect(dto.multiplier).toBe('1.50')
    expect(dto.ticketType).toBe('CHANGE')
    expect(dto.window).toBe('HOLIDAY')
    expect(dto.position).toBe(3)
    expect(dto.priorityName).toBe('Crítica')
  })

  it('curinga sem prioridade vinculada', () => {
    const dto = toSdContractRateDTO(createFakeSdContractRate())
    expect(dto.ticketType).toBeNull()
    expect(dto.priorityId).toBeNull()
    expect(dto.priorityName).toBeNull()
  })
})

describe('toSdContractPeriodDTO', () => {
  it('converte datas em ISO e o valor em string', () => {
    const dto = toSdContractPeriodDTO(
      createFakeSdContractPeriod({
        status: 'CLOSED',
        usedMinutes: 700,
        billableMinutes: 650,
        overageMinutes: 50,
        carriedMinutes: 0,
        amount: new Prisma.Decimal('166.667'),
        closedAt: new Date('2026-11-01T03:00:00.000Z'),
        closedBy: {
          id: 'u9',
          name: 'Admin',
          email: 'admin@example.com',
          image: null,
        },
      }),
    )
    expect(dto.periodStart).toBe('2026-10-01T00:00:00.000Z')
    expect(dto.periodEnd).toBe('2026-11-01T00:00:00.000Z')
    expect(dto.status).toBe('CLOSED')
    expect(dto.amount).toBe('166.67')
    expect(dto.closedAt).toBe('2026-11-01T03:00:00.000Z')
    expect(dto.closedBy?.id).toBe('u9')
  })

  it('período aberto não tem fechamento', () => {
    const dto = toSdContractPeriodDTO(createFakeSdContractPeriod())
    expect(dto.closedAt).toBeNull()
    expect(dto.closedBy).toBeNull()
  })
})

describe('toSdContractDTO', () => {
  it('expõe o contrato com regras, cliente e período corrente', () => {
    const dto = toSdContractDTO(
      createFakeSdContract({
        rates: [createFakeSdContractRate()],
        periods: [createFakeSdContractPeriod()],
        slaPolicy: { id: 'sla1', name: 'Padrão' },
        slaPolicyId: 'sla1',
        ticketTypes: ['INCIDENT', 'CHANGE'],
      }),
    )
    expect(dto.hourlyRate).toBe('150.00')
    expect(dto.overtimeRate).toBe('200.00')
    expect(dto.rates).toHaveLength(1)
    expect(dto.currentPeriod?.id).toBe('per1')
    expect(dto.slaPolicyName).toBe('Padrão')
    expect(dto.ticketTypes).toEqual(['INCIDENT', 'CHANGE'])
    expect(dto.startsAt).toBe('2026-01-01T00:00:00.000Z')
    expect(dto.endsAt).toBeNull()
  })

  it('sem hora de excedente, sem período e sem SLA devolve nulos', () => {
    const dto = toSdContractDTO(
      createFakeSdContract({
        overtimeRate: null,
        endsAt: new Date('2026-12-31T00:00:00.000Z'),
      }),
    )
    expect(dto.overtimeRate).toBeNull()
    expect(dto.currentPeriod).toBeNull()
    expect(dto.slaPolicyName).toBeNull()
    expect(dto.slaPolicyId).toBeNull()
    expect(dto.endsAt).toBe('2026-12-31T00:00:00.000Z')
  })
})

describe('sdPeriodPercentUsed', () => {
  it('arredonda a fração da franquia consumida', () => {
    expect(
      sdPeriodPercentUsed({ includedMinutes: 600, billableMinutes: 150 }),
    ).toBe(25)
    expect(
      sdPeriodPercentUsed({ includedMinutes: 600, billableMinutes: 900 }),
    ).toBe(150)
  })

  it('sem franquia ou sem período não há percentual', () => {
    expect(
      sdPeriodPercentUsed({ includedMinutes: 0, billableMinutes: 90 }),
    ).toBeNull()
    expect(sdPeriodPercentUsed(null)).toBeNull()
  })
})

describe('toSdContractSummaryDTO', () => {
  it('junta contrato, período e percentual', () => {
    const dto = toSdContractSummaryDTO(
      createFakeSdContract(),
      createFakeSdContractPeriod({ billableMinutes: 600 }),
    )
    expect(dto.contract?.id).toBe('ct1')
    expect(dto.period?.id).toBe('per1')
    expect(dto.percentUsed).toBe(50)
  })

  it('cliente sem contrato vigente devolve tudo nulo', () => {
    expect(toSdContractSummaryDTO(null, null)).toEqual({
      contract: null,
      period: null,
      percentUsed: null,
    })
  })
})
