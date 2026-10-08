import type { WikiLabel } from '@prisma/client'
import type { WikiLabelColor } from '@/src/schemas/wiki-label.schema'
import type { WikiLabelDTO } from '@/types/wiki-label'
import { withTimestamps } from './_shared'

export function toWikiLabelDTO(
  label: WikiLabel & { pageCount?: number },
): WikiLabelDTO {
  return {
    id: label.id,
    workspaceId: label.workspaceId,
    name: label.name,
    color: label.color as WikiLabelColor,
    pageCount: label.pageCount ?? 0,
    ...withTimestamps(label),
  }
}
