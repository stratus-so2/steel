import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { Value } from 'platejs'
import type {
  SdKbArticleDTO,
  SdKbArticleStatusDTO,
  SdKbArticleSummaryDTO,
  SdKbCategoryDTO,
  SdKbMentionableMemberDTO,
  SdKbSearchResultDTO,
  SdKbVisibilityDTO,
  SdKbVoteResultDTO,
  SdTicketKbLinkDTO,
} from '@/types/sd-kb-article'
import type { SdKbCommentDTO } from '@/types/sd-kb-comment'
import type {
  SdKbDraftFromTicketDTO,
  SdKbReviewDTO,
  SdKbReviewSettingsDTO,
  SdKbReviewStateDTO,
  SdKbStatsResultDTO,
} from '@/types/sd-kb-review'
import { apiFetch, apiSend } from './_fetch'

/**
 * Hooks da base de conhecimento do ServiceDesk (artigos, busca, votos,
 * comentários do editor e vínculo com chamados).
 */

function base(workspaceId: string) {
  return `/api/workspaces/${workspaceId}/servicedesk/knowledge`
}

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const sdKbKeys = {
  all: (workspaceId: string) => ['sd-kb', workspaceId] as const,
  articles: (workspaceId: string, archived = false) =>
    ['sd-kb', workspaceId, 'articles', { archived }] as const,
  article: (workspaceId: string, articleId: string) =>
    ['sd-kb', workspaceId, 'article', articleId] as const,
  search: (workspaceId: string, filters: SdKbSearchFilters) =>
    ['sd-kb', workspaceId, 'search', filters] as const,
  categories: (workspaceId: string) =>
    ['sd-kb', workspaceId, 'categories'] as const,
  related: (workspaceId: string, articleId: string) =>
    ['sd-kb', workspaceId, 'related', articleId] as const,
  comments: (workspaceId: string, articleId: string) =>
    ['sd-kb', workspaceId, 'comments', articleId] as const,
  members: (workspaceId: string, q: string) =>
    ['sd-kb', workspaceId, 'members', q] as const,
  ticketLinks: (workspaceId: string, ticketId: string) =>
    ['sd-kb', workspaceId, 'ticket-links', ticketId] as const,
  suggestions: (workspaceId: string, ticketId: string) =>
    ['sd-kb', workspaceId, 'suggest', ticketId] as const,
  reviewState: (workspaceId: string, articleId: string) =>
    ['sd-kb', workspaceId, 'review-state', articleId] as const,
  reviews: (workspaceId: string, filters: SdKbReviewFilters) =>
    ['sd-kb', workspaceId, 'reviews', filters] as const,
  reviewSettings: (workspaceId: string) =>
    ['sd-kb', workspaceId, 'review-settings'] as const,
  stats: (workspaceId: string, limit: number) =>
    ['sd-kb', workspaceId, 'stats', limit] as const,
}

export interface SdKbReviewFilters {
  status?: 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED'
  mine?: boolean
  limit?: number
}

export interface SdKbSearchFilters {
  q?: string
  status?: SdKbArticleStatusDTO
  visibility?: SdKbVisibilityDTO
  categoryId?: string
  tag?: string
  limit?: number
}

export interface UpdateSdKbArticleInput {
  title?: string
  icon?: string | null
  coverImage?: string | null
  content?: Value
  categoryId?: string | null
  visibility?: SdKbVisibilityDTO
  tags?: string[]
}

// ─── Artigos ────────────────────────────────────────────────────────────────

export function useSdKbArticles(workspaceId: string, archived = false) {
  return useQuery({
    queryKey: sdKbKeys.articles(workspaceId, archived),
    queryFn: () =>
      apiFetch<SdKbArticleSummaryDTO[]>(
        `${base(workspaceId)}${query({ archived: archived ? 'true' : undefined })}`,
        undefined,
        'Erro ao carregar a base de conhecimento',
      ),
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
  })
}

export function useSdKbArticle(
  workspaceId: string,
  articleId: string,
  initialData?: SdKbArticleDTO,
) {
  return useQuery({
    queryKey: sdKbKeys.article(workspaceId, articleId),
    queryFn: () =>
      apiFetch<SdKbArticleDTO>(
        `${base(workspaceId)}/${articleId}`,
        undefined,
        'Erro ao carregar o artigo',
      ),
    enabled: !!workspaceId && !!articleId,
    initialData,
    staleTime: 30 * 1000,
  })
}

/** Atualiza artigo no cache (detalhe + árvore) depois de uma mutação. */
function useSyncArticle(workspaceId: string) {
  const queryClient = useQueryClient()
  return (updated: SdKbArticleDTO) => {
    queryClient.setQueryData(sdKbKeys.article(workspaceId, updated.id), updated)
    queryClient.setQueryData<SdKbArticleSummaryDTO[]>(
      sdKbKeys.articles(workspaceId, false),
      (old) =>
        old?.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)),
    )
  }
}

export function useCreateSdKbArticle(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      title?: string
      parentId?: string
      icon?: string
      categoryId?: string
      visibility?: SdKbVisibilityDTO
      tags?: string[]
    }) =>
      apiFetch<SdKbArticleDTO>(
        base(workspaceId),
        json('POST', data),
        'Erro ao criar artigo',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sdKbKeys.all(workspaceId) })
    },
  })
}

export function useUpdateSdKbArticle(workspaceId: string, articleId: string) {
  const sync = useSyncArticle(workspaceId)
  return useMutation({
    mutationFn: (data: UpdateSdKbArticleInput) =>
      apiFetch<SdKbArticleDTO>(
        `${base(workspaceId)}/${articleId}`,
        json('PATCH', data),
        'Erro ao salvar o artigo',
      ),
    onSuccess: sync,
  })
}

export function useSetSdKbArticleStatus(
  workspaceId: string,
  articleId: string,
) {
  const sync = useSyncArticle(workspaceId)
  return useMutation({
    mutationFn: (status: SdKbArticleStatusDTO) =>
      apiFetch<SdKbArticleDTO>(
        `${base(workspaceId)}/${articleId}/status`,
        json('PATCH', { status }),
        'Erro ao alterar o status do artigo',
      ),
    onSuccess: sync,
  })
}

export function useMoveSdKbArticle(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      articleId,
      parentId,
      position,
    }: {
      articleId: string
      parentId: string | null
      position: number
    }) =>
      apiFetch<SdKbArticleDTO>(
        `${base(workspaceId)}/${articleId}/move`,
        json('PATCH', { parentId, position }),
        'Erro ao mover o artigo',
      ),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: sdKbKeys.articles(workspaceId, false),
      })
    },
  })
}

function withoutSubtree(articles: SdKbArticleSummaryDTO[], rootId: string) {
  const removed = new Set([rootId])
  let grew = true
  while (grew) {
    grew = false
    for (const article of articles) {
      if (
        article.parentId &&
        removed.has(article.parentId) &&
        !removed.has(article.id)
      ) {
        removed.add(article.id)
        grew = true
      }
    }
  }
  return articles.filter((article) => !removed.has(article.id))
}

export function useArchiveSdKbArticle(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (articleId: string) =>
      apiFetch<SdKbArticleDTO>(
        `${base(workspaceId)}/${articleId}/archive`,
        { method: 'PATCH' },
        'Erro ao arquivar o artigo',
      ),
    // O servidor arquiva a subárvore inteira: tira os descendentes também.
    onSuccess: (archived) => {
      queryClient.setQueryData<SdKbArticleSummaryDTO[]>(
        sdKbKeys.articles(workspaceId, false),
        (old) => old && withoutSubtree(old, archived.id),
      )
      queryClient.invalidateQueries({ queryKey: sdKbKeys.all(workspaceId) })
    },
  })
}

export function useRestoreSdKbArticle(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (articleId: string) =>
      apiFetch<SdKbArticleDTO>(
        `${base(workspaceId)}/${articleId}/restore`,
        { method: 'PATCH' },
        'Erro ao restaurar o artigo',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sdKbKeys.all(workspaceId) })
    },
  })
}

export function useDeleteSdKbArticle(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (articleId: string) =>
      apiSend(
        `${base(workspaceId)}/${articleId}`,
        { method: 'DELETE' },
        'Erro ao excluir o artigo',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sdKbKeys.all(workspaceId) })
    },
  })
}

// ─── Leitura: busca, categorias, relacionados, visualização e voto ─────────

export function useSdKbSearch(
  workspaceId: string,
  filters: SdKbSearchFilters,
  enabled = true,
) {
  return useQuery({
    queryKey: sdKbKeys.search(workspaceId, filters),
    queryFn: () =>
      apiFetch<SdKbSearchResultDTO[]>(
        `${base(workspaceId)}/search${query({ ...filters })}`,
        undefined,
        'Erro ao buscar artigos',
      ),
    enabled: !!workspaceId && enabled,
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  })
}

export function useSdKbCategories(workspaceId: string) {
  return useQuery({
    queryKey: sdKbKeys.categories(workspaceId),
    queryFn: () =>
      apiFetch<SdKbCategoryDTO[]>(
        `${base(workspaceId)}/categories`,
        undefined,
        'Erro ao carregar categorias',
      ),
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useSdKbRelated(workspaceId: string, articleId: string) {
  return useQuery({
    queryKey: sdKbKeys.related(workspaceId, articleId),
    queryFn: () =>
      apiFetch<SdKbArticleSummaryDTO[]>(
        `${base(workspaceId)}/${articleId}/related`,
        undefined,
        'Erro ao carregar artigos relacionados',
      ),
    enabled: !!workspaceId && !!articleId,
    staleTime: 60 * 1000,
  })
}

export function useRecordSdKbView(workspaceId: string) {
  return useMutation({
    mutationFn: (articleId: string) =>
      apiFetch<{ viewCount: number; counted: boolean }>(
        `${base(workspaceId)}/${articleId}/view`,
        { method: 'POST' },
        'Erro ao registrar a visualização',
      ),
  })
}

export function useVoteSdKbArticle(workspaceId: string, articleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (helpful: boolean | null) =>
      apiFetch<SdKbVoteResultDTO>(
        `${base(workspaceId)}/${articleId}/vote`,
        json('PUT', { helpful }),
        'Erro ao registrar o voto',
      ),
    onSuccess: (result) => {
      queryClient.setQueryData<SdKbArticleDTO>(
        sdKbKeys.article(workspaceId, articleId),
        (old) => old && { ...old, ...result },
      )
    },
  })
}

// ─── Comentários (discussões do editor) ─────────────────────────────────────

function commentsRoute(workspaceId: string, articleId: string) {
  return `${base(workspaceId)}/${articleId}/comments`
}

export function useSdKbComments(workspaceId: string, articleId: string) {
  return useQuery({
    queryKey: sdKbKeys.comments(workspaceId, articleId),
    queryFn: () =>
      apiFetch<SdKbCommentDTO[]>(
        commentsRoute(workspaceId, articleId),
        undefined,
        'Erro ao buscar comentários',
      ),
    enabled: !!workspaceId && !!articleId,
    staleTime: 30 * 1000,
    // Sem Yjs/Hocuspocus: comentários de outros agentes chegam por polling.
    refetchInterval: 30 * 1000,
  })
}

function useInvalidateComments(workspaceId: string, articleId: string) {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({
      queryKey: sdKbKeys.comments(workspaceId, articleId),
    })
}

export function useCreateSdKbComment(workspaceId: string, articleId: string) {
  const invalidate = useInvalidateComments(workspaceId, articleId)
  return useMutation({
    mutationFn: (data: { markId: string; content: Value; parentId?: string }) =>
      apiFetch<SdKbCommentDTO>(
        commentsRoute(workspaceId, articleId),
        json('POST', data),
        'Erro ao comentar',
      ),
    onSuccess: invalidate,
  })
}

export function useUpdateSdKbComment(workspaceId: string, articleId: string) {
  const invalidate = useInvalidateComments(workspaceId, articleId)
  return useMutation({
    mutationFn: ({
      commentId,
      content,
    }: {
      commentId: string
      content: Value
    }) =>
      apiFetch<SdKbCommentDTO>(
        `${commentsRoute(workspaceId, articleId)}/${commentId}`,
        json('PATCH', { content }),
        'Erro ao editar comentário',
      ),
    onSuccess: invalidate,
  })
}

export function useResolveSdKbComment(workspaceId: string, articleId: string) {
  const invalidate = useInvalidateComments(workspaceId, articleId)
  return useMutation({
    mutationFn: ({
      commentId,
      resolved,
    }: {
      commentId: string
      resolved: boolean
    }) =>
      apiFetch<SdKbCommentDTO>(
        `${commentsRoute(workspaceId, articleId)}/${commentId}/resolve`,
        json('PATCH', { resolved }),
        'Erro ao atualizar a discussão',
      ),
    onSuccess: invalidate,
  })
}

export function useDeleteSdKbComment(workspaceId: string, articleId: string) {
  const invalidate = useInvalidateComments(workspaceId, articleId)
  return useMutation({
    mutationFn: (commentId: string) =>
      apiSend(
        `${commentsRoute(workspaceId, articleId)}/${commentId}`,
        { method: 'DELETE' },
        'Erro ao excluir comentário',
      ),
    onSuccess: invalidate,
  })
}

export function useSdKbMentionableMembers(workspaceId: string, q: string) {
  return useQuery({
    queryKey: sdKbKeys.members(workspaceId, q),
    queryFn: () =>
      apiFetch<SdKbMentionableMemberDTO[]>(
        `${base(workspaceId)}/members${query({ q })}`,
        undefined,
        'Erro ao buscar membros',
      ),
    enabled: !!workspaceId,
    placeholderData: keepPreviousData,
  })
}

// ─── Chamado ↔ artigo ───────────────────────────────────────────────────────

function ticketLinksRoute(workspaceId: string, ticketId: string) {
  return `/api/workspaces/${workspaceId}/servicedesk/tickets/${ticketId}/kb-links`
}

export function useSdTicketKbLinks(workspaceId: string, ticketId: string) {
  return useQuery({
    queryKey: sdKbKeys.ticketLinks(workspaceId, ticketId),
    queryFn: () =>
      apiFetch<SdTicketKbLinkDTO[]>(
        ticketLinksRoute(workspaceId, ticketId),
        undefined,
        'Erro ao carregar artigos vinculados',
      ),
    enabled: !!workspaceId && !!ticketId,
  })
}

export function useSdKbSuggestions(
  workspaceId: string,
  ticketId: string,
  limit = 5,
) {
  return useQuery({
    queryKey: sdKbKeys.suggestions(workspaceId, ticketId),
    queryFn: () =>
      apiFetch<SdKbSearchResultDTO[]>(
        `${base(workspaceId)}/suggest${query({ ticketId, limit })}`,
        undefined,
        'Erro ao sugerir artigos',
      ),
    enabled: !!workspaceId && !!ticketId,
    staleTime: 60 * 1000,
  })
}

export function useLinkSdKbArticle(workspaceId: string, ticketId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (articleId: string) =>
      apiFetch<SdTicketKbLinkDTO>(
        ticketLinksRoute(workspaceId, ticketId),
        json('POST', { articleId }),
        'Erro ao vincular o artigo',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: sdKbKeys.ticketLinks(workspaceId, ticketId),
      })
    },
  })
}

export function useUnlinkSdKbArticle(workspaceId: string, ticketId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (articleId: string) =>
      apiSend(
        `${ticketLinksRoute(workspaceId, ticketId)}${query({ articleId })}`,
        { method: 'DELETE' },
        'Erro ao desvincular o artigo',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: sdKbKeys.ticketLinks(workspaceId, ticketId),
      })
    },
  })
}

// ─── KCS: revisão, validade, reuso e curadoria ──────────────────────────────

/** Estado da revisão do artigo (validade, prazo, pendência e histórico). */
export function useSdKbReviewState(workspaceId: string, articleId: string) {
  return useQuery({
    queryKey: sdKbKeys.reviewState(workspaceId, articleId),
    queryFn: () =>
      apiFetch<SdKbReviewStateDTO>(
        `${base(workspaceId)}/${articleId}/reviews`,
        undefined,
        'Erro ao carregar a revisão do artigo',
      ),
    enabled: !!workspaceId && !!articleId,
    staleTime: 30 * 1000,
  })
}

/** Fila de revisões do workspace (ou só as minhas). */
export function useSdKbReviews(
  workspaceId: string,
  filters: SdKbReviewFilters = {},
) {
  return useQuery({
    queryKey: sdKbKeys.reviews(workspaceId, filters),
    queryFn: () =>
      apiFetch<SdKbReviewDTO[]>(
        `${base(workspaceId)}/reviews${query({
          status: filters.status,
          mine: filters.mine ? 'true' : undefined,
          limit: filters.limit,
        })}`,
        undefined,
        'Erro ao carregar as revisões',
      ),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
  })
}

/** Invalida o artigo, a revisão e a árvore depois de uma mudança de ciclo. */
function useSyncReview(workspaceId: string, articleId: string) {
  const queryClient = useQueryClient()
  return (state: SdKbReviewStateDTO) => {
    queryClient.setQueryData(
      sdKbKeys.reviewState(workspaceId, articleId),
      state,
    )
    queryClient.invalidateQueries({ queryKey: sdKbKeys.all(workspaceId) })
  }
}

export function useRequestSdKbReview(workspaceId: string, articleId: string) {
  const sync = useSyncReview(workspaceId, articleId)
  return useMutation({
    mutationFn: (data: { reviewerId: string; comment?: string }) =>
      apiFetch<SdKbReviewStateDTO>(
        `${base(workspaceId)}/${articleId}/reviews`,
        json('POST', data),
        'Erro ao pedir revisão',
      ),
    onSuccess: sync,
  })
}

export function useDecideSdKbReview(workspaceId: string, articleId: string) {
  const sync = useSyncReview(workspaceId, articleId)
  return useMutation({
    mutationFn: ({
      reviewId,
      ...data
    }: {
      reviewId: string
      decision: 'APPROVE' | 'REQUEST_CHANGES'
      comment?: string
      reviewIntervalDays?: number | null
    }) =>
      apiFetch<SdKbReviewStateDTO>(
        `${base(workspaceId)}/reviews/${reviewId}`,
        json('PATCH', data),
        'Erro ao registrar a decisão',
      ),
    onSuccess: sync,
  })
}

export function useCancelSdKbReview(workspaceId: string, articleId: string) {
  const sync = useSyncReview(workspaceId, articleId)
  return useMutation({
    mutationFn: (reviewId: string) =>
      apiFetch<SdKbReviewStateDTO>(
        `${base(workspaceId)}/reviews/${reviewId}`,
        { method: 'DELETE' },
        'Erro ao cancelar a revisão',
      ),
    onSuccess: sync,
  })
}

export function useSetSdKbReviewInterval(
  workspaceId: string,
  articleId: string,
) {
  const sync = useSyncReview(workspaceId, articleId)
  return useMutation({
    mutationFn: (reviewIntervalDays: number | null) =>
      apiFetch<SdKbReviewStateDTO>(
        `${base(workspaceId)}/${articleId}/review-interval`,
        json('PATCH', { reviewIntervalDays }),
        'Erro ao alterar a validade da revisão',
      ),
    onSuccess: sync,
  })
}

export function useSdKbReviewSettings(workspaceId: string) {
  return useQuery({
    queryKey: sdKbKeys.reviewSettings(workspaceId),
    queryFn: () =>
      apiFetch<SdKbReviewSettingsDTO>(
        `${base(workspaceId)}/review-settings`,
        undefined,
        'Erro ao carregar a validade padrão',
      ),
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
  })
}

/** Painel de curadoria (mais reusados, vencidos, sem reuso). */
export function useSdKbStats(workspaceId: string, limit = 5) {
  return useQuery({
    queryKey: sdKbKeys.stats(workspaceId, limit),
    queryFn: () =>
      apiFetch<SdKbStatsResultDTO>(
        `${base(workspaceId)}/stats${query({ limit })}`,
        undefined,
        'Erro ao carregar os números da base',
      ),
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
  })
}

/** "Este artigo resolveu o chamado" — é o que conta no reuso (KCS). */
export function useMarkSdKbResolved(workspaceId: string, ticketId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      articleId,
      resolved,
    }: {
      articleId: string
      resolved: boolean
    }) =>
      apiFetch<SdTicketKbLinkDTO>(
        `${base(workspaceId)}/${articleId}/resolved`,
        json('PATCH', { ticketId, resolved }),
        'Erro ao marcar o artigo que resolveu',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: sdKbKeys.ticketLinks(workspaceId, ticketId),
      })
      queryClient.invalidateQueries({ queryKey: sdKbKeys.all(workspaceId) })
    },
  })
}

/** Cria o rascunho KCS a partir do chamado (com IA, quando disponível). */
export function useDraftSdKbArticleFromTicket(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      ticketId: string
      useAi?: boolean
      categoryId?: string
    }) =>
      apiFetch<SdKbDraftFromTicketDTO>(
        `${base(workspaceId)}/draft`,
        json('POST', data),
        'Erro ao criar o artigo a partir do chamado',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sdKbKeys.all(workspaceId) })
    },
  })
}

/** Sugestões para um chamado que ainda não existe (tela de abertura). */
export function useSdKbDraftSuggestions(
  workspaceId: string,
  input: { title: string; description?: string; categoryIds?: string[] },
  enabled = true,
) {
  const title = input.title.trim()
  return useQuery({
    queryKey: [
      'sd-kb',
      workspaceId,
      'suggest-draft',
      title,
      input.categoryIds ?? [],
    ] as const,
    queryFn: () =>
      apiFetch<SdKbSearchResultDTO[]>(
        `${base(workspaceId)}/suggest/draft`,
        json('POST', {
          title,
          description: input.description ?? '',
          categoryIds: input.categoryIds ?? [],
        }),
        'Erro ao sugerir artigos',
      ),
    enabled: !!workspaceId && enabled && title.length >= 3,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  })
}
