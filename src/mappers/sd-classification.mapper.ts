import type { SdClassification } from '@prisma/client'
import type { SdClassificationDTO } from '@/types/sd-config'

export function toSdClassificationDTO(
  classification: SdClassification,
): SdClassificationDTO {
  return {
    id: classification.id,
    kind: classification.kind,
    name: classification.name,
    description: classification.description,
    color: classification.color,
    ticketTypes: classification.ticketTypes,
    active: classification.active,
    position: classification.position,
    createdAt: classification.createdAt.toISOString(),
    updatedAt: classification.updatedAt.toISOString(),
  }
}
