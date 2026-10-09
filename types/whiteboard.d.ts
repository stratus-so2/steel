import type { WhiteboardScene } from '@/src/schemas/whiteboard.schema'

export type WhiteboardVersionKind = 'AUTO' | 'MANUAL' | 'RESTORE'

export interface WhiteboardPersonDTO {
  id: string
  name: string
}

/** Who holds the edit lease and until when. */
export interface WhiteboardLockDTO {
  holder: WhiteboardPersonDTO
  until: string
}

/** A board in the list: no scene, so the sidebar stays light. */
export interface WhiteboardSummaryDTO {
  id: string
  workspaceId: string
  title: string
  revision: number
  /** Same-origin PNG preview, cache-busted by its timestamp; `null` = none. */
  thumbnailUrl: string | null
  createdBy: WhiteboardPersonDTO | null
  updatedBy: WhiteboardPersonDTO | null
  archivedAt: string | null
  /** Last content or title change. */
  editedAt: string
  createdAt: string
}

export interface WhiteboardDTO extends WhiteboardSummaryDTO {
  scene: WhiteboardScene
  /** Active lease (expired ones read as `null`). */
  lock: WhiteboardLockDTO | null
}

/** Result of acquiring/renewing the lease. */
export interface WhiteboardLockStateDTO {
  /** `true` when the caller may edit now (holds the lease). */
  canEdit: boolean
  /** `true` for VIEWER: never edits, regardless of the lease. */
  readOnlyRole: boolean
  lock: WhiteboardLockDTO | null
}

export interface WhiteboardSaveResultDTO {
  revision: number
  editedAt: string
  /** An automatic version was cut by this save. */
  versionCreated: boolean
}

export interface WhiteboardVersionSummaryDTO {
  id: string
  whiteboardId: string
  kind: WhiteboardVersionKind
  name: string | null
  revision: number
  elementCount: number
  restoredFromId: string | null
  createdBy: WhiteboardPersonDTO | null
  createdAt: string
}

export interface WhiteboardVersionDTO extends WhiteboardVersionSummaryDTO {
  scene: WhiteboardScene
}

export interface WhiteboardSettingsDTO {
  enabled: boolean
}
