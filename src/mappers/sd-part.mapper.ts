import type { SdPart } from '@prisma/client'
import type { SdPartDTO } from '@/types/sd-config'

export function toSdPartDTO(part: SdPart): SdPartDTO {
  return {
    id: part.id,
    name: part.name,
    sku: part.sku,
    description: part.description,
    unitCost: part.unitCost.toFixed(2),
    stock: part.stock,
    active: part.active,
    createdAt: part.createdAt.toISOString(),
    updatedAt: part.updatedAt.toISOString(),
  }
}
