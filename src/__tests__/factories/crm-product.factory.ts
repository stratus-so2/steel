import { createId } from '@paralleldrive/cuid2'
import { type CrmProduct, Prisma } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { CrmProductDTO } from '@/types/crm-product'

export function createFakeCrmProduct(
  overrides?: Partial<CrmProduct>,
): CrmProduct {
  const now = new Date()
  return {
    id: createId(),
    workspaceId: createId(),
    name: 'Plano Pro',
    sku: null,
    description: null,
    unitPrice: new Prisma.Decimal(0),
    currency: 'BRL',
    billingType: 'ONE_TIME',
    active: true,
    position: 0,
    createdById: createId(),
    updatedById: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

export function createFakeCrmProductDTO(
  overrides?: Partial<CrmProductDTO>,
): CrmProductDTO {
  const now = new Date().toISOString()
  return {
    id: createId(),
    workspaceId: createId(),
    name: 'Plano Pro',
    sku: null,
    description: null,
    unitPrice: 0,
    currency: 'BRL',
    billingType: 'ONE_TIME',
    active: true,
    position: 0,
    createdById: createId(),
    updatedById: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedCrmProduct(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<
    Pick<
      CrmProduct,
      'name' | 'sku' | 'unitPrice' | 'active' | 'position' | 'deletedAt'
    >
  >,
) {
  return prisma.crmProduct.create({
    data: { name: 'Seed Product', workspaceId, createdById, ...overrides },
  })
}
