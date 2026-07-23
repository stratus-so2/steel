import { createId } from '@paralleldrive/cuid2'
import { type CrmQuota, Prisma } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { CrmQuotaDTO } from '@/types/crm-quota'

export function createFakeCrmQuota(overrides?: Partial<CrmQuota>): CrmQuota {
  const now = new Date()
  return {
    id: createId(),
    workspaceId: createId(),
    ownerId: createId(),
    period: 'MONTH',
    periodKey: '2026-08',
    targetAmount: new Prisma.Decimal(0),
    createdById: createId(),
    updatedById: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function createFakeCrmQuotaDTO(
  overrides?: Partial<CrmQuotaDTO>,
): CrmQuotaDTO {
  const now = new Date().toISOString()
  return {
    id: createId(),
    workspaceId: createId(),
    ownerId: createId(),
    period: 'MONTH',
    periodKey: '2026-08',
    targetAmount: 0,
    createdById: createId(),
    updatedById: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedCrmQuota(
  workspaceId: string,
  ownerId: string,
  createdById: string,
  overrides?: Partial<Pick<CrmQuota, 'period' | 'periodKey' | 'targetAmount'>>,
) {
  return prisma.crmQuota.create({
    data: {
      workspaceId,
      ownerId,
      createdById,
      period: 'MONTH',
      periodKey: '2026-08',
      ...overrides,
    },
  })
}
