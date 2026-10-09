'use client'

import '@excalidraw/excalidraw/index.css'
import {
  CaptureUpdateAction,
  Excalidraw,
  exportToBlob,
  exportToSvg,
  MainMenu,
  useHandleLibrary,
} from '@excalidraw/excalidraw'
import type { NonDeletedExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type {
  AppState,
  BinaryFileData,
  BinaryFiles,
  ExcalidrawImperativeAPI,
  LibraryItems,
} from '@excalidraw/excalidraw/types'
import { useTheme } from 'next-themes'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EXCALIDRAW_ASSET_PATH } from '@/lib/excalidraw/asset-path'
import { isApiErrorCode } from '@/src/hooks/_fetch'
import {
  acquireWhiteboardLock,
  releaseWhiteboardLock,
  saveWhiteboardScene,
  uploadWhiteboardImage,
  uploadWhiteboardThumbnail,
  whiteboardImageUrl,
  whiteboardsRoute,
} from '@/src/hooks/use-whiteboard'
import type { WhiteboardScene } from '@/src/schemas/whiteboard.schema'
import type { WhiteboardDTO, WhiteboardLockDTO } from '@/types/whiteboard'
import {
  blobToDataUrl,
  dataUrlToBlob,
  pendingUploads,
  sceneSignature,
  toPersistedScene,
} from './whiteboard-scene'

declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string | string[]
  }
}

// Fonts come from this origin (CSP `font-src 'self'`); see next.config.ts.
if (typeof window !== 'undefined') {
  window.EXCALIDRAW_ASSET_PATH = EXCALIDRAW_ASSET_PATH
}

export type WhiteboardSyncStatus =
  | 'loading'
  | 'saved'
  | 'saving'
  | 'dirty'
  | 'error'
  | 'conflict'
  | 'readonly'

export interface WhiteboardCanvasState {
  status: WhiteboardSyncStatus
  canEdit: boolean
  /** Who holds the edit lease when it is someone else. */
  lockedBy: WhiteboardLockDTO | null
  readOnlyRole: boolean
}

export interface WhiteboardCanvasController {
  /** Saves what is pending now (before a manual version, before leaving). */
  flush: () => Promise<void>
  /** Replaces the canvas with a scene from the server (restore, reload). */
  load: (board: WhiteboardDTO) => void
  /** Renders a scene as SVG for the history preview. */
  renderPreview: (scene: WhiteboardScene) => Promise<SVGSVGElement>
}

const SAVE_DEBOUNCE_MS = 1500
const LEASE_RENEW_MS = 20_000
const THUMBNAIL_EVERY_MS = 30_000
const LIBRARY_KEY = 'steel:whiteboard:library'

/** Personal library, kept in this browser (Excalidraw's own model). */
const libraryAdapter = {
  load() {
    try {
      const raw = window.localStorage.getItem(LIBRARY_KEY)
      return raw ? { libraryItems: JSON.parse(raw) as LibraryItems } : null
    } catch {
      return null
    }
  },
  save({ libraryItems }: { libraryItems: LibraryItems }) {
    try {
      window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(libraryItems))
    } catch {
      // Storage full or blocked: the library just won't persist.
    }
  },
}

async function loadFiles(
  workspaceId: string,
  scene: WhiteboardScene,
): Promise<BinaryFileData[]> {
  const files = await Promise.all(
    Object.values(scene.files).map(async (ref) => {
      try {
        const res = await fetch(whiteboardImageUrl(workspaceId, ref.id))
        if (!res.ok) return null
        const dataURL = await blobToDataUrl(await res.blob())
        return {
          id: ref.id,
          mimeType: ref.mimeType,
          created: ref.created,
          dataURL,
        } as BinaryFileData
      } catch {
        return null
      }
    }),
  )
  return files.filter((file): file is BinaryFileData => file !== null)
}

export default function WhiteboardCanvas({
  board,
  workspaceId,
  roleCanEdit,
  onState,
  onController,
}: {
  board: WhiteboardDTO
  workspaceId: string
  /** Not a VIEWER (the lease still decides who edits right now). */
  roleCanEdit: boolean
  onState: (state: WhiteboardCanvasState) => void
  onController: (controller: WhiteboardCanvasController) => void
}) {
  const { resolvedTheme } = useTheme()
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  useHandleLibrary({ excalidrawAPI: api, adapter: libraryAdapter })

  const revision = useRef(board.revision)
  const savedSignature = useRef(sceneSignature(board.scene))
  const uploaded = useRef(new Set(Object.keys(board.scene.files)))
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saving = useRef<Promise<void> | null>(null)
  const canEditRef = useRef(false)
  const lastThumbnail = useRef(0)
  const stateRef = useRef<WhiteboardCanvasState>({
    status: 'loading',
    canEdit: false,
    lockedBy: null,
    readOnlyRole: !roleCanEdit,
  })

  const emit = useCallback(
    (patch: Partial<WhiteboardCanvasState>) => {
      stateRef.current = { ...stateRef.current, ...patch }
      onState(stateRef.current)
    },
    [onState],
  )

  const currentScene = useCallback((): WhiteboardScene | null => {
    if (!api) return null
    return toPersistedScene(
      api.getSceneElements() as never,
      api.getAppState() as never,
      api.getFiles() as never,
    )
  }, [api])

  const uploadThumbnail = useCallback(async () => {
    if (!api) return
    lastThumbnail.current = Date.now()
    const elements = api.getSceneElements()
    if (elements.length === 0) return
    try {
      const png = await exportToBlob({
        elements: elements as readonly NonDeletedExcalidrawElement[],
        appState: {
          ...api.getAppState(),
          exportBackground: true,
          exportWithDarkMode: false,
        },
        files: api.getFiles(),
        maxWidthOrHeight: 480,
        mimeType: 'image/png',
      })
      await uploadWhiteboardThumbnail(workspaceId, board.id, png)
    } catch {
      // A missing preview never blocks drawing.
    }
  }, [api, workspaceId, board.id])

  const uploadImages = useCallback(async () => {
    if (!api) return
    const pending = pendingUploads(api.getFiles() as never, uploaded.current)
    for (const file of pending) {
      const blob = await dataUrlToBlob(file.dataURL)
      await uploadWhiteboardImage(workspaceId, file.id, blob)
      uploaded.current.add(file.id)
    }
  }, [api, workspaceId])

  const save = useCallback(
    async (options: { keepalive?: boolean } = {}) => {
      if (!canEditRef.current) return
      const scene = currentScene()
      if (!scene) return
      const signature = sceneSignature(scene)
      if (signature === savedSignature.current) {
        emit({ status: 'saved' })
        return
      }
      emit({ status: 'saving' })
      try {
        await uploadImages()
        const result = await saveWhiteboardScene(
          workspaceId,
          board.id,
          scene,
          revision.current,
          options,
        )
        revision.current = result.revision
        savedSignature.current = signature
        emit({ status: 'saved' })
        if (Date.now() - lastThumbnail.current > THUMBNAIL_EVERY_MS) {
          void uploadThumbnail()
        }
      } catch (error) {
        if (isApiErrorCode(error, 'WHITEBOARD_LOCKED')) {
          canEditRef.current = false
          setCanEdit(false)
          emit({ status: 'readonly', canEdit: false })
        } else if (isApiErrorCode(error, 'WHITEBOARD_REVISION_CONFLICT')) {
          emit({ status: 'conflict' })
        } else {
          emit({ status: 'error' })
        }
      }
    },
    [board.id, currentScene, emit, uploadImages, uploadThumbnail, workspaceId],
  )

  const flush = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    if (saving.current) await saving.current
    saving.current = save()
    await saving.current
    saving.current = null
  }, [save])

  const applyBoard = useCallback(
    async (next: WhiteboardDTO) => {
      if (!api) return
      revision.current = next.revision
      savedSignature.current = sceneSignature(next.scene)
      api.updateScene({
        elements: next.scene.elements as never,
        appState: next.scene.appState as never,
        captureUpdate: CaptureUpdateAction.NEVER,
      })
      const files = await loadFiles(workspaceId, next.scene)
      for (const file of files) uploaded.current.add(file.id)
      if (files.length) api.addFiles(files)
      emit({ status: canEditRef.current ? 'saved' : 'readonly' })
    },
    [api, emit, workspaceId],
  )

  const reload = useCallback(async () => {
    const res = await fetch(`${whiteboardsRoute(workspaceId)}/${board.id}`)
    if (!res.ok) return
    const body = (await res.json()) as { data: WhiteboardDTO }
    if (body.data.revision !== revision.current) await applyBoard(body.data)
  }, [applyBoard, board.id, workspaceId])

  // Images of the first scene (the scene itself comes via initialData).
  useEffect(() => {
    if (!api) return
    void loadFiles(workspaceId, board.scene).then((files) => {
      if (files.length) api.addFiles(files)
    })
  }, [api, board.scene, workspaceId])

  // Edit lease: take it on open, renew while editing, retry while someone
  // else holds it (and follow their changes meanwhile).
  useEffect(() => {
    if (!api) return
    let alive = true
    async function tick() {
      try {
        const state = await acquireWhiteboardLock(workspaceId, board.id)
        if (!alive) return
        const was = canEditRef.current
        if (state.canEdit && !was) await reload()
        if (!state.canEdit) await reload()
        canEditRef.current = state.canEdit
        setCanEdit(state.canEdit)
        const lockedBy = state.lock && !state.canEdit ? state.lock : null
        emit({
          canEdit: state.canEdit,
          lockedBy,
          readOnlyRole: state.readOnlyRole,
          status: state.canEdit
            ? stateRef.current.status === 'loading' ||
              stateRef.current.status === 'readonly'
              ? 'saved'
              : stateRef.current.status
            : 'readonly',
        })
      } catch {
        if (alive && stateRef.current.status === 'loading') {
          emit({ status: 'readonly' })
        }
      }
    }
    void tick()
    const timer = setInterval(tick, LEASE_RENEW_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [api, board.id, emit, reload, workspaceId])

  // Latest closures for the unmount handler, which must run only once.
  const latest = useRef({ save, uploadThumbnail })
  latest.current = { save, uploadThumbnail }

  // Leaving the board: save what is pending, preview it, free the lease.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && canEditRef.current) {
        void latest.current.save({ keepalive: true })
      }
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      if (canEditRef.current) {
        const { save: saveNow, uploadThumbnail: preview } = latest.current
        void saveNow({ keepalive: true }).finally(() => {
          void preview()
          void releaseWhiteboardLock(workspaceId, board.id)
        })
      }
    }
  }, [board.id, workspaceId])

  useEffect(() => {
    onController({
      flush,
      load: (next) => void applyBoard(next),
      renderPreview: async (scene) =>
        exportToSvg({
          elements: scene.elements as never,
          appState: {
            ...scene.appState,
            exportBackground: true,
            exportWithDarkMode: resolvedTheme === 'dark',
          } as never,
          files: (api?.getFiles() ?? {}) as BinaryFiles,
          exportPadding: 16,
          skipInliningFonts: true,
        }),
    })
  }, [api, applyBoard, flush, onController, resolvedTheme])

  const handleChange = useCallback(
    (
      _elements: readonly unknown[],
      _appState: AppState,
      _files: BinaryFiles,
    ) => {
      if (!canEditRef.current) return
      const scene = currentScene()
      if (!scene || sceneSignature(scene) === savedSignature.current) return
      if (stateRef.current.status !== 'dirty') emit({ status: 'dirty' })
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null
        void flush()
      }, SAVE_DEBOUNCE_MS)
    },
    [currentScene, emit, flush],
  )

  const initialData = useMemo(
    () => ({
      elements: board.scene.elements as never,
      appState: { ...board.scene.appState } as never,
      scrollToContent: board.scene.appState.scrollX === undefined,
    }),
    [board.scene],
  )

  return (
    <div className='whiteboard-canvas h-full w-full'>
      <Excalidraw
        excalidrawAPI={setApi}
        initialData={initialData}
        onChange={handleChange}
        langCode='pt-BR'
        theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
        viewModeEnabled={!canEdit}
        name={board.title || 'Quadro'}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            toggleTheme: false,
            export: { saveFileToDisk: true },
            saveAsImage: true,
          },
        }}
      >
        <MainMenu>
          <MainMenu.DefaultItems.Export />
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.SearchMenu />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
          <MainMenu.DefaultItems.Help />
        </MainMenu>
      </Excalidraw>
    </div>
  )
}
