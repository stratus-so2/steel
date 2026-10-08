import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { Value } from 'platejs'
import type { EditorMentionableMember } from '@/components/editor/editor-document-context'
import type { WikiLabelDTO, WikiSettingsDTO } from '@/types/wiki-label'
import type { WikiPageDTO } from '@/types/wiki-page'
import { apiFetch, apiFetchJson, apiSend } from './_fetch'

function wikiPagesKey(workspaceId: string) {
  return ['wiki-pages', workspaceId] as const
}

function baseRoute(workspaceId: string) {
  return `/api/workspaces/${workspaceId}/wiki`
}

export function useWikiPages(workspaceId: string) {
  return useQuery({
    queryKey: wikiPagesKey(workspaceId),
    queryFn: () =>
      apiFetch<WikiPageDTO[]>(
        baseRoute(workspaceId),
        undefined,
        'Erro ao buscar páginas de wiki',
      ),
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
  })
}

export function useCreateWikiPage(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { title?: string; parentId?: string; icon?: string }) =>
      apiFetchJson<WikiPageDTO>(
        baseRoute(workspaceId),
        'POST',
        data,
        'Erro ao criar página',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: wikiPagesKey(workspaceId) })
    },
  })
}

export function useUpdateWikiPage(workspaceId: string, wikiPageId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      title?: string
      icon?: string | null
      coverImage?: string | null
      content?: Value
    }) =>
      apiFetchJson<WikiPageDTO>(
        `${baseRoute(workspaceId)}/${wikiPageId}`,
        'PATCH',
        data,
        'Erro ao salvar página',
      ),
    onSuccess: (updated) => {
      queryClient.setQueryData<WikiPageDTO[]>(
        wikiPagesKey(workspaceId),
        (old) => old?.map((p) => (p.id === updated.id ? updated : p)),
      )
    },
  })
}

function withoutSubtree(pages: WikiPageDTO[], rootId: string) {
  const removed = new Set([rootId])
  let grew = true
  while (grew) {
    grew = false
    for (const page of pages) {
      if (
        page.parentId &&
        removed.has(page.parentId) &&
        !removed.has(page.id)
      ) {
        removed.add(page.id)
        grew = true
      }
    }
  }
  return pages.filter((page) => !removed.has(page.id))
}

export function useArchiveWikiPage(workspaceId: string, wikiPageId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      apiFetchJson<WikiPageDTO>(
        `${baseRoute(workspaceId)}/${wikiPageId}/archive`,
        'PATCH',
        {},
        'Erro ao arquivar página',
      ),
    // The server archives the whole subtree, so drop the descendants too.
    onSuccess: () => {
      queryClient.setQueryData<WikiPageDTO[]>(
        wikiPagesKey(workspaceId),
        (old) => old && withoutSubtree(old, wikiPageId),
      )
    },
  })
}

export function useSetWikiPageLabels(workspaceId: string, wikiPageId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (labelIds: string[]) =>
      apiFetchJson<WikiPageDTO>(
        `${baseRoute(workspaceId)}/${wikiPageId}/labels`,
        'PUT',
        { labelIds },
        'Erro ao salvar as etiquetas',
      ),
    onSuccess: (updated) => {
      queryClient.setQueryData<WikiPageDTO[]>(
        wikiPagesKey(workspaceId),
        (old) => old?.map((p) => (p.id === updated.id ? updated : p)),
      )
      // Page counts on Ajustes > Wiki.
      queryClient.invalidateQueries({ queryKey: wikiLabelsKey(workspaceId) })
    },
  })
}

export function useWikiMentionableMembers(workspaceId: string, q: string) {
  return useQuery({
    queryKey: ['wiki-members', workspaceId, q] as const,
    queryFn: () =>
      apiFetch<EditorMentionableMember[]>(
        `${baseRoute(workspaceId)}/members?${new URLSearchParams({ q })}`,
        undefined,
        'Erro ao buscar membros',
      ),
    enabled: !!workspaceId,
    placeholderData: keepPreviousData,
  })
}

// ─── Ajustes > Wiki ─────────────────────────────────────────────────────────

function wikiSettingsKey(workspaceId: string) {
  return ['wiki-settings', workspaceId] as const
}

function wikiLabelsKey(workspaceId: string) {
  return ['wiki-labels', workspaceId] as const
}

export function useWikiSettings(workspaceId: string) {
  return useQuery({
    queryKey: wikiSettingsKey(workspaceId),
    queryFn: () =>
      apiFetch<WikiSettingsDTO>(
        `${baseRoute(workspaceId)}/settings`,
        undefined,
        'Erro ao buscar os ajustes da Wiki',
      ),
    enabled: !!workspaceId,
  })
}

export function useUpdateWikiSettings(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { enabled: boolean }) =>
      apiFetchJson<WikiSettingsDTO>(
        `${baseRoute(workspaceId)}/settings`,
        'PATCH',
        data,
        'Erro ao salvar os ajustes da Wiki',
      ),
    onSuccess: (settings) => {
      queryClient.setQueryData(wikiSettingsKey(workspaceId), settings)
    },
  })
}

export function useWikiLabels(workspaceId: string) {
  return useQuery({
    queryKey: wikiLabelsKey(workspaceId),
    queryFn: () =>
      apiFetch<WikiLabelDTO[]>(
        `${baseRoute(workspaceId)}/labels`,
        undefined,
        'Erro ao buscar as etiquetas',
      ),
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
  })
}

export function useCreateWikiLabel(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { name: string; color: string }) =>
      apiFetchJson<WikiLabelDTO>(
        `${baseRoute(workspaceId)}/labels`,
        'POST',
        data,
        'Erro ao criar a etiqueta',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: wikiLabelsKey(workspaceId) })
    },
  })
}

export function useUpdateWikiLabel(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      labelId,
      ...data
    }: {
      labelId: string
      name?: string
      color?: string
    }) =>
      apiFetchJson<WikiLabelDTO>(
        `${baseRoute(workspaceId)}/labels/${labelId}`,
        'PATCH',
        data,
        'Erro ao salvar a etiqueta',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: wikiLabelsKey(workspaceId) })
    },
  })
}

export function useDeleteWikiLabel(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (labelId: string) =>
      apiSend(
        `${baseRoute(workspaceId)}/labels/${labelId}`,
        { method: 'DELETE' },
        'Erro ao excluir a etiqueta',
      ),
    onSuccess: (_data, labelId) => {
      queryClient.invalidateQueries({ queryKey: wikiLabelsKey(workspaceId) })
      // The label is gone from every page too (cascade).
      queryClient.setQueryData<WikiPageDTO[]>(
        wikiPagesKey(workspaceId),
        (old) =>
          old?.map((p) => ({
            ...p,
            labelIds: p.labelIds.filter((id) => id !== labelId),
          })),
      )
    },
  })
}
