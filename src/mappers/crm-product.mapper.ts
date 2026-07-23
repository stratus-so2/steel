import type { CrmProduct } from '@prisma/client'
import type { CrmProductDTO } from '@/types/crm-product'

export function toCrmProductDTO(product: CrmProduct): CrmProductDTO {
  return {
    id: product.id,
    workspaceId: product.workspaceId,
    name: product.name,
    sku: product.sku,
    description: product.description,
    unitPrice: Number(product.unitPrice),
    currency: product.currency,
    billingType: product.billingType,
    active: product.active,
    position: product.position,
    createdById: product.createdById,
    updatedById: product.updatedById,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  }
}
