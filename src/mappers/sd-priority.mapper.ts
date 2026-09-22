import type { SdPriorityMatrix } from '@prisma/client'
import type { SdScaleRow } from '@/src/repositories/sd-priority.repository'
import type { SdScaleKind } from '@/src/schemas/sd-priority.schema'
import type { SdPriorityMatrixCellDTO, SdScaleItemDTO } from '@/types/sd-config'

export function toSdScaleItemDTO(
  kind: SdScaleKind,
  row: SdScaleRow,
): SdScaleItemDTO {
  return {
    id: row.id,
    kind,
    name: row.name,
    description: row.description ?? null,
    color: row.color ?? null,
    level: row.level,
    isDefault: row.isDefault ?? false,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toSdPriorityMatrixCellDTO(
  cell: SdPriorityMatrix,
): SdPriorityMatrixCellDTO {
  return {
    impactId: cell.impactId,
    urgencyId: cell.urgencyId,
    priorityId: cell.priorityId,
  }
}
