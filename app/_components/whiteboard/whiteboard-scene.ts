import type { WhiteboardScene } from '@/src/schemas/whiteboard.schema'

/**
 * Pure helpers between the Excalidraw runtime and the persisted scene. Kept
 * free of `@excalidraw/excalidraw` imports so they load (and test) without
 * the canvas bundle.
 */

type LooseElement = {
  id: string
  type: string
  version?: number
  isDeleted?: boolean
  fileId?: string | null
  [key: string]: unknown
}

type LooseAppState = {
  viewBackgroundColor?: string
  gridSize?: number | null
  gridModeEnabled?: boolean
  scrollX?: number
  scrollY?: number
  zoom?: { value: number }
}

type LooseFile = { id: string; mimeType: string; created: number }

const IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
])

/**
 * What gets saved: live elements only, the appState subset the server keeps
 * (background, grid, viewport) and refs of the images still on the canvas.
 */
export function toPersistedScene(
  elements: readonly LooseElement[],
  appState: LooseAppState,
  files: Record<string, LooseFile>,
): WhiteboardScene {
  const live = elements.filter((element) => !element.isDeleted)
  const usedFiles = new Set(
    live
      .map((element) => element.fileId)
      .filter((id): id is string => typeof id === 'string'),
  )
  const refs: WhiteboardScene['files'] = {}
  for (const id of usedFiles) {
    const file = files[id]
    if (file && IMAGE_TYPES.has(file.mimeType)) {
      refs[id] = {
        id,
        mimeType: file.mimeType as WhiteboardScene['files'][string]['mimeType'],
        created: Math.max(0, Math.floor(file.created || 0)),
      }
    }
  }
  return {
    elements: live.map((element) => ({ ...element })),
    appState: {
      viewBackgroundColor: appState.viewBackgroundColor,
      gridSize: appState.gridSize ?? null,
      gridModeEnabled: appState.gridModeEnabled ?? false,
      scrollX: Number.isFinite(appState.scrollX) ? appState.scrollX : 0,
      scrollY: Number.isFinite(appState.scrollY) ? appState.scrollY : 0,
      zoom: { value: appState.zoom?.value ?? 1 },
    },
    files: refs,
  }
}

/**
 * Cheap change detector: element ids + versions + the persisted appState.
 * Excalidraw fires `onChange` on every pointer move; only a different
 * signature schedules a save.
 */
export function sceneSignature(scene: WhiteboardScene): string {
  const elements = scene.elements
    .map((element) => `${element.id}:${String(element.version ?? 0)}`)
    .join(',')
  const { scrollX = 0, scrollY = 0, zoom, ...rest } = scene.appState
  // Viewport moves are saved too, but rounded so a pan of 1px is not a save.
  const view = `${Math.round(scrollX / 50)}|${Math.round(scrollY / 50)}|${(zoom?.value ?? 1).toFixed(2)}`
  return `${elements}#${JSON.stringify(rest)}#${view}#${Object.keys(scene.files).sort().join(',')}`
}

/** Images on the canvas whose bytes are not stored yet. */
export function pendingUploads(
  files: Record<string, { id: string; dataURL?: string; mimeType: string }>,
  uploaded: ReadonlySet<string>,
): { id: string; dataURL: string; mimeType: string }[] {
  return Object.values(files).filter(
    (file): file is { id: string; dataURL: string; mimeType: string } =>
      !uploaded.has(file.id) &&
      typeof file.dataURL === 'string' &&
      file.dataURL.startsWith('data:') &&
      IMAGE_TYPES.has(file.mimeType),
  )
}

export async function dataUrlToBlob(dataURL: string): Promise<Blob> {
  const res = await fetch(dataURL)
  return res.blob()
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
