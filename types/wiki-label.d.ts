import type { WikiLabelColor } from '@/src/schemas/wiki-label.schema'

export interface WikiLabelDTO {
  id: string
  workspaceId: string
  name: string
  color: WikiLabelColor
  /** Live (non-archived) pages carrying this label. */
  pageCount: number
  createdAt: string
  updatedAt: string
}

export interface WikiSettingsDTO {
  enabled: boolean
}
