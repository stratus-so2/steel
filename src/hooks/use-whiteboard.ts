import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { WhiteboardScene } from '@/src/schemas/whiteboard.schema'
import type {
  WhiteboardDTO,
  WhiteboardLockStateDTO,
  WhiteboardSaveResultDTO,
  WhiteboardSettingsDTO,
  WhiteboardSummaryDTO,
  WhiteboardVersionDTO,
  WhiteboardVersionSummaryDTO,
} from '@/types/whiteboard'
import { apiFetch, apiFetchJson } from './_fetch'

export function whiteboardsRoute(workspaceId: string) {
  return `/api/workspaces/${workspaceId}/whiteboards`
}

export const whiteboardKeys = {
  all: (workspaceId: string) => ['whiteboards', workspaceId] as const,
  list: (workspaceId: string, q: string, archived: boolean) =>
    ['whiteboards', workspaceId, 'list', { q, archived }] as const,
  board: (workspaceId: string, id: string) =>
    ['whiteboards', workspaceId, 'board', id] as const,
  versions: (workspaceId: string, id: string) =>
    ['whiteboards', workspaceId, 'versions', id] as const,
  version: (workspaceId: string, id: string, versionId: string) =>
    ['whiteboards', workspaceId, 'version', id, versionId] as const,
  settings: (workspaceId: string) =>
    ['whiteboard-settings', workspaceId] as const,
}

export function useWhiteboards(
  workspaceId: string,
  filter: { q?: string; archived?: boolean } = {},
  initialData?: WhiteboardSummaryDTO[] | null,
) {
  const q = filter.q?.trim() ?? ''
  const archived = filter.archived ?? false
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (archived) params.set('archived', 'true')
  const query = params.toString()
  return useQuery({
    queryKey: whiteboardKeys.list(workspaceId, q, archived),
    queryFn: () =>
      apiFetch<WhiteboardSummaryDTO[]>(
        `${whiteboardsRoute(workspaceId)}${query ? `?${query}` : ''}`,
        undefined,
        'Erro ao buscar os quadros',
      ),
    // The server-rendered list only matches the unfiltered view.
    initialData: !q && !archived ? (initialData ?? undefined) : undefined,
    placeholderData: keepPreviousData,
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
  })
}

/** Board with its scene; kept in cache so switching back is instant. */
export function useWhiteboard(
  workspaceId: string,
  whiteboardId: string,
  initialData?: WhiteboardDTO,
) {
  return useQuery({
    queryKey: whiteboardKeys.board(workspaceId, whiteboardId),
    queryFn: () =>
      apiFetch<WhiteboardDTO>(
        `${whiteboardsRoute(workspaceId)}/${whiteboardId}`,
        undefined,
        'Erro ao abrir o quadro',
      ),
    initialData,
    enabled: !!workspaceId && !!whiteboardId,
    // The canvas owns the scene while open; refetching would reset it.
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  })
}

function useInvalidateLists(workspaceId: string) {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({
      queryKey: [...whiteboardKeys.all(workspaceId), 'list'],
    })
}

export function useCreateWhiteboard(workspaceId: string) {
  const invalidate = useInvalidateLists(workspaceId)
  return useMutation({
    mutationFn: (data: { title?: string }) =>
      apiFetchJson<WhiteboardDTO>(
        whiteboardsRoute(workspaceId),
        'POST',
        data,
        'Erro ao criar o quadro',
      ),
    onSuccess: invalidate,
  })
}

export function useRenameWhiteboard(workspaceId: string) {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateLists(workspaceId)
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      apiFetchJson<WhiteboardDTO>(
        `${whiteboardsRoute(workspaceId)}/${id}`,
        'PATCH',
        { title },
        'Erro ao renomear o quadro',
      ),
    onSuccess: (board) => {
      queryClient.setQueryData<WhiteboardDTO>(
        whiteboardKeys.board(workspaceId, board.id),
        (old) => (old ? { ...old, title: board.title } : old),
      )
      invalidate()
    },
  })
}

export function useDuplicateWhiteboard(workspaceId: string) {
  const invalidate = useInvalidateLists(workspaceId)
  return useMutation({
    mutationFn: (id: string) =>
      apiFetchJson<WhiteboardDTO>(
        `${whiteboardsRoute(workspaceId)}/${id}/duplicate`,
        'POST',
        {},
        'Erro ao duplicar o quadro',
      ),
    onSuccess: invalidate,
  })
}

export function useArchiveWhiteboard(workspaceId: string) {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateLists(workspaceId)
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      apiFetchJson<WhiteboardDTO>(
        `${whiteboardsRoute(workspaceId)}/${id}/archive`,
        'PATCH',
        { archived },
        archived ? 'Erro ao arquivar o quadro' : 'Erro ao restaurar o quadro',
      ),
    onSuccess: (board) => {
      queryClient.removeQueries({
        queryKey: whiteboardKeys.board(workspaceId, board.id),
      })
      invalidate()
    },
  })
}

/** Autosave; the caller passes the revision it loaded. */
export function saveWhiteboardScene(
  workspaceId: string,
  id: string,
  scene: WhiteboardScene,
  baseRevision: number,
  options: { keepalive?: boolean } = {},
) {
  const body = JSON.stringify({ scene, baseRevision })
  return apiFetch<WhiteboardSaveResultDTO>(
    `${whiteboardsRoute(workspaceId)}/${id}/scene`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body,
      // Browsers cap keepalive bodies at 64 KB; bigger scenes go as usual.
      keepalive: options.keepalive && body.length < 60_000,
    },
    'Erro ao salvar o quadro',
  )
}

export function acquireWhiteboardLock(workspaceId: string, id: string) {
  return apiFetch<WhiteboardLockStateDTO>(
    `${whiteboardsRoute(workspaceId)}/${id}/lock`,
    { method: 'POST' },
    'Erro ao abrir o quadro para edição',
  )
}

export function releaseWhiteboardLock(workspaceId: string, id: string) {
  return fetch(`${whiteboardsRoute(workspaceId)}/${id}/lock`, {
    method: 'DELETE',
    keepalive: true,
  }).catch(() => undefined)
}

export function uploadWhiteboardThumbnail(
  workspaceId: string,
  id: string,
  png: Blob,
) {
  return apiFetch<{ thumbnailAt: string }>(
    `${whiteboardsRoute(workspaceId)}/${id}/thumbnail`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      body: png,
    },
    'Erro ao salvar a miniatura',
  )
}

export function uploadWhiteboardImage(
  workspaceId: string,
  fileId: string,
  file: Blob,
) {
  const form = new FormData()
  form.set('fileId', fileId)
  form.set('file', file, fileId)
  return apiFetch<{ fileId: string }>(
    `${whiteboardsRoute(workspaceId)}/files`,
    { method: 'POST', body: form },
    'Erro ao enviar a imagem',
  )
}

export function whiteboardImageUrl(workspaceId: string, fileId: string) {
  return `${whiteboardsRoute(workspaceId)}/files/${encodeURIComponent(fileId)}`
}

export function useWhiteboardVersions(
  workspaceId: string,
  whiteboardId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: whiteboardKeys.versions(workspaceId, whiteboardId),
    queryFn: () =>
      apiFetch<WhiteboardVersionSummaryDTO[]>(
        `${whiteboardsRoute(workspaceId)}/${whiteboardId}/versions`,
        undefined,
        'Erro ao buscar o histórico',
      ),
    enabled: enabled && !!workspaceId && !!whiteboardId,
  })
}

export function useWhiteboardVersion(
  workspaceId: string,
  whiteboardId: string,
  versionId: string | null,
) {
  return useQuery({
    queryKey: whiteboardKeys.version(
      workspaceId,
      whiteboardId,
      versionId ?? '',
    ),
    queryFn: () =>
      apiFetch<WhiteboardVersionDTO>(
        `${whiteboardsRoute(workspaceId)}/${whiteboardId}/versions/${versionId}`,
        undefined,
        'Erro ao abrir a versão',
      ),
    enabled: !!versionId,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function useCreateWhiteboardVersion(
  workspaceId: string,
  whiteboardId: string,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name?: string }) =>
      apiFetchJson<WhiteboardVersionSummaryDTO>(
        `${whiteboardsRoute(workspaceId)}/${whiteboardId}/versions`,
        'POST',
        data,
        'Erro ao salvar a versão',
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: whiteboardKeys.versions(workspaceId, whiteboardId),
      }),
  })
}

export function useRestoreWhiteboardVersion(
  workspaceId: string,
  whiteboardId: string,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (versionId: string) =>
      apiFetchJson<WhiteboardDTO>(
        `${whiteboardsRoute(workspaceId)}/${whiteboardId}/versions/${versionId}/restore`,
        'POST',
        {},
        'Erro ao restaurar a versão',
      ),
    onSuccess: (board) => {
      queryClient.setQueryData(
        whiteboardKeys.board(workspaceId, whiteboardId),
        board,
      )
      queryClient.invalidateQueries({
        queryKey: whiteboardKeys.versions(workspaceId, whiteboardId),
      })
    },
  })
}

export function useWhiteboardSettings(workspaceId: string) {
  return useQuery({
    queryKey: whiteboardKeys.settings(workspaceId),
    queryFn: () =>
      apiFetch<WhiteboardSettingsDTO>(
        `/api/workspaces/${workspaceId}/whiteboard/settings`,
        undefined,
        'Erro ao buscar os ajustes do Quadro-branco',
      ),
    enabled: !!workspaceId,
  })
}

export function useUpdateWhiteboardSettings(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { enabled: boolean }) =>
      apiFetchJson<WhiteboardSettingsDTO>(
        `/api/workspaces/${workspaceId}/whiteboard/settings`,
        'PATCH',
        data,
        'Erro ao salvar os ajustes do Quadro-branco',
      ),
    onSuccess: (settings) =>
      queryClient.setQueryData(whiteboardKeys.settings(workspaceId), settings),
  })
}
