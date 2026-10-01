import { createId } from '@paralleldrive/cuid2'
import { Prisma } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { SdContractWithRelations } from '@/src/repositories/sd-contract.repository'
import type { SdContractPeriodWithRelations } from '@/src/repositories/sd-contract-period.repository'
import type { SdTimeEntryWithRelations } from '@/src/repositories/sd-time-entry.repository'

/**
 * Fábricas de contratos de atendimento, períodos de faturamento e
 * apontamentos de hora: fakes para os testes unitários e seeds no banco
 * para os de integração.
 */

const fixed = () => new Date('2026-10-07T12:00:00.000Z')

const user = () => ({
  id: 'u1',
  name: 'Ana Agente',
  email: 'ana@example.com',
  image: null,
})

/* ------------------------------ fakes (unit) ------------------------------ */

export function createFakeSdContractRate(
  overrides?: Partial<SdContractWithRelations['rates'][number]>,
): SdContractWithRelations['rates'][number] {
  return {
    id: createId(),
    contractId: 'ct1',
    ticketType: null,
    priorityId: null,
    window: 'BUSINESS_HOURS',
    hourlyRate: new Prisma.Decimal('150.00'),
    multiplier: new Prisma.Decimal('1.00'),
    position: 0,
    createdAt: fixed(),
    priority: null,
    ...overrides,
  }
}

export function createFakeSdContract(
  overrides?: Partial<SdContractWithRelations>,
): SdContractWithRelations {
  return {
    id: 'ct1',
    workspaceId: 'ws1',
    customerId: 'cus1',
    name: 'Suporte mensal 20 h',
    code: 'CT-001',
    status: 'ACTIVE',
    startsAt: new Date('2026-01-01T00:00:00.000Z'),
    endsAt: null,
    billingCycle: 'MONTHLY',
    includedMinutes: 1200,
    carryOver: false,
    hourlyRate: new Prisma.Decimal('150.00'),
    overtimeRate: new Prisma.Decimal('200.00'),
    roundingMinutes: 15,
    minimumMinutes: 30,
    ticketTypes: [],
    slaPolicyId: null,
    notes: null,
    createdById: 'u1',
    createdAt: fixed(),
    updatedAt: fixed(),
    deletedAt: null,
    customer: { id: 'cus1', name: 'Stratus Telecom', tradeName: null },
    slaPolicy: null,
    createdBy: user(),
    rates: [],
    periods: [],
    ...overrides,
  }
}

export function createFakeSdContractPeriod(
  overrides?: Partial<SdContractPeriodWithRelations>,
): SdContractPeriodWithRelations {
  return {
    id: 'per1',
    workspaceId: 'ws1',
    contractId: 'ct1',
    periodStart: new Date('2026-10-01T00:00:00.000Z'),
    periodEnd: new Date('2026-11-01T00:00:00.000Z'),
    status: 'OPEN',
    includedMinutes: 1200,
    usedMinutes: 0,
    billableMinutes: 0,
    overageMinutes: 0,
    carriedMinutes: 0,
    amount: new Prisma.Decimal('0'),
    closedAt: null,
    closedById: null,
    createdAt: fixed(),
    updatedAt: fixed(),
    closedBy: null,
    ...overrides,
  }
}

export function createFakeSdTimeEntry(
  overrides?: Partial<SdTimeEntryWithRelations>,
): SdTimeEntryWithRelations {
  return {
    id: createId(),
    workspaceId: 'ws1',
    ticketId: 't1',
    userId: 'u1',
    contractId: 'ct1',
    periodId: 'per1',
    source: 'TIMER',
    startedAt: new Date('2026-10-07T13:00:00.000Z'),
    endedAt: new Date('2026-10-07T14:00:00.000Z'),
    minutes: 60,
    billable: true,
    window: 'BUSINESS_HOURS',
    amount: new Prisma.Decimal('150.00'),
    description: 'Troca do switch',
    createdAt: fixed(),
    updatedAt: fixed(),
    deletedAt: null,
    user: user(),
    ...overrides,
  }
}

/* -------------------------- seeds (integração) --------------------------- */

export async function seedSdContract(
  workspaceId: string,
  customerId: string,
  createdById: string,
  overrides?: Partial<Prisma.SdContractUncheckedCreateInput>,
) {
  return prisma.sdContract.create({
    data: {
      workspaceId,
      customerId,
      createdById,
      name: 'Suporte mensal',
      status: 'ACTIVE',
      startsAt: new Date('2026-01-01T00:00:00.000Z'),
      includedMinutes: 600,
      hourlyRate: '150.00',
      roundingMinutes: 15,
      minimumMinutes: 30,
      ...overrides,
    },
  })
}

export async function seedSdContractRate(
  contractId: string,
  overrides?: Partial<Prisma.SdContractRateUncheckedCreateInput>,
) {
  return prisma.sdContractRate.create({
    data: { contractId, hourlyRate: '180.00', ...overrides },
  })
}

export async function seedSdContractPeriod(
  workspaceId: string,
  contractId: string,
  overrides?: Partial<Prisma.SdContractPeriodUncheckedCreateInput>,
) {
  return prisma.sdContractPeriod.create({
    data: {
      workspaceId,
      contractId,
      periodStart: new Date('2026-10-01T00:00:00.000Z'),
      periodEnd: new Date('2026-11-01T00:00:00.000Z'),
      includedMinutes: 600,
      ...overrides,
    },
  })
}

export async function seedSdTimeEntry(
  workspaceId: string,
  ticketId: string,
  userId: string,
  overrides?: Partial<Prisma.SdTimeEntryUncheckedCreateInput>,
) {
  return prisma.sdTimeEntry.create({
    data: {
      workspaceId,
      ticketId,
      userId,
      startedAt: new Date('2026-10-07T13:00:00.000Z'),
      endedAt: new Date('2026-10-07T14:00:00.000Z'),
      minutes: 60,
      ...overrides,
    },
  })
}
