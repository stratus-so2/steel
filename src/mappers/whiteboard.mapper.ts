import type { WhiteboardScene } from '@/src/schemas/whiteboard.schema'
import type {
  WhiteboardDTO,
  WhiteboardLockDTO,
  WhiteboardSummaryDTO,
  WhiteboardVersionDTO,
  WhiteboardVersionSummaryDTO,
} from '@/types/whiteboard'
import type {
  Whiteboard,
  WhiteboardListItem,
} from '../repositories/whiteboard.repository'
import type {
  WhiteboardVersion,
  WhiteboardVersionListItem,
} from '../repositories/whiteboard-version.repository'

/** Same-origin preview URL, cache-busted by the thumbnail's own time. */
export function whiteboardThumbnailUrl(
  board: Pick<WhiteboardListItem, 'id' | 'workspaceId' | 'thumbnailAt'>,
): string | null {
  if (!board.thumbnailAt) return null
  return `/api/workspaces/${board.workspaceId}/whiteboards/${board.id}/thumbnail?v=${board.thumbnailAt.getTime()}`
}

/** The active lease, or `null` when there is none or it already expired. */
export function toWhiteboardLockDTO(
  board: Pick<WhiteboardListItem, 'lockedBy' | 'lockedUntil'>,
  now: Date,
): WhiteboardLockDTO | null {
  if (!board.lockedBy || !board.lockedUntil) return null
  if (board.lockedUntil.getTime() <= now.getTime()) return null
  return {
    holder: board.lockedBy,
    until: board.lockedUntil.toISOString(),
  }
}

export function toWhiteboardSummaryDTO(
  board: WhiteboardListItem,
): WhiteboardSummaryDTO {
  return {
    id: board.id,
    workspaceId: board.workspaceId,
    title: board.title,
    revision: board.revision,
    thumbnailUrl: whiteboardThumbnailUrl(board),
    createdBy: board.createdBy,
    updatedBy: board.updatedBy,
    archivedAt: board.archivedAt?.toISOString() ?? null,
    editedAt: board.editedAt.toISOString(),
    createdAt: board.createdAt.toISOString(),
  }
}

/** Rows written before a scene field existed still read as a valid scene. */
export function toWhiteboardScene(value: unknown): WhiteboardScene {
  const scene = (value ?? {}) as Partial<WhiteboardScene>
  return {
    elements: Array.isArray(scene.elements) ? scene.elements : [],
    appState: scene.appState ?? {},
    files: scene.files ?? {},
  }
}

export function toWhiteboardDTO(
  board: Whiteboard,
  now: Date = new Date(),
): WhiteboardDTO {
  return {
    ...toWhiteboardSummaryDTO(board),
    scene: toWhiteboardScene(board.scene),
    lock: toWhiteboardLockDTO(board, now),
  }
}

export function toWhiteboardVersionSummaryDTO(
  version: WhiteboardVersionListItem,
): WhiteboardVersionSummaryDTO {
  return {
    id: version.id,
    whiteboardId: version.whiteboardId,
    kind: version.kind,
    name: version.name,
    revision: version.revision,
    elementCount: version.elementCount,
    restoredFromId: version.restoredFromId,
    createdBy: version.createdBy,
    createdAt: version.createdAt.toISOString(),
  }
}

export function toWhiteboardVersionDTO(
  version: WhiteboardVersion,
): WhiteboardVersionDTO {
  return {
    ...toWhiteboardVersionSummaryDTO(version),
    scene: toWhiteboardScene(version.scene),
  }
}

/** Live (not deleted) elements: what the history panel counts. */
export function countLiveElements(scene: WhiteboardScene): number {
  return scene.elements.filter((element) => element.isDeleted !== true).length
}

/** Text of the live text elements, for the global search body. */
export function whiteboardSceneText(scene: WhiteboardScene): string {
  return scene.elements
    .filter(
      (element) =>
        element.isDeleted !== true &&
        element.type === 'text' &&
        typeof element.text === 'string',
    )
    .map((element) => element.text as string)
    .join(' ')
}
