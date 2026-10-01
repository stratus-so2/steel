import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CreateSdPortalTicketDTO,
  ListSdPortalTicketsDTO,
} from '@/src/schemas/sd-portal.schema'
import type {
  SdPortalFormOptionsDTO,
  SdPortalKbArticleDTO,
  SdPortalKbListDTO,
  SdPortalMessageDTO,
  SdPortalSessionDTO,
  SdPortalTicketDetailDTO,
  SdPortalTicketSummaryDTO,
} from '@/types/sd-portal'
import { apiFetch, apiSend } from './_fetch'

/**
 * Portal do **contato externo** (`/suporte`). Fala só com
 * `/api/servicedesk/portal/**`, que usa o cookie próprio
 * `sd.portal_session` — nenhuma chamada daqui depende de sessão do Steel
 * nem recebe `workspaceId`: o escopo vem da sessão, no servidor.
 */

const BASE = '/api/servicedesk/portal'

export const sdPortalKeys = {
  session: ['sd-portal', 'session'] as const,
  options: ['sd-portal', 'options'] as const,
  tickets: (query?: Partial<ListSdPortalTicketsDTO>) =>
    ['sd-portal', 'tickets', query ?? {}] as const,
  ticket: (code: string) => ['sd-portal', 'ticket', code] as const,
  knowledge: (q: string, categoryId?: string) =>
    ['sd-portal', 'knowledge', q, categoryId ?? null] as const,
  article: (id: string) => ['sd-portal', 'article', id] as const,
}

function search(query: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const text = params.toString()
  return text ? `?${text}` : ''
}

/** Pede o link mágico (resposta genérica, sempre). */
export function useRequestSdPortalLink() {
  return useMutation({
    mutationFn: (email: string) =>
      apiFetch<{ message: string }>(
        `${BASE}/link`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        },
        'Não conseguimos enviar o link agora',
      ),
  })
}

/** Consome o token do link e abre a sessão de 12 horas. */
export function useOpenSdPortalSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (token: string) =>
      apiFetch<SdPortalSessionDTO>(
        `${BASE}/session`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        },
        'Não conseguimos abrir o portal com este link',
      ),
    onSuccess: (session) => {
      queryClient.setQueryData(sdPortalKeys.session, session)
    },
  })
}

/** A sessão corrente (quem está no portal e em qual workspace). */
export function useSdPortalSession(enabled = true) {
  return useQuery({
    queryKey: sdPortalKeys.session,
    queryFn: () =>
      apiFetch<SdPortalSessionDTO>(
        `${BASE}/session`,
        undefined,
        'Sua sessão expirou',
      ),
    enabled,
    retry: false,
    staleTime: 60_000,
  })
}

export function useCloseSdPortalSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiSend(`${BASE}/session`, { method: 'DELETE' }),
    onSuccess: () => queryClient.clear(),
  })
}

export function useSdPortalTickets(query: Partial<ListSdPortalTicketsDTO>) {
  return useQuery({
    queryKey: sdPortalKeys.tickets(query),
    queryFn: () =>
      apiFetch<{
        items: SdPortalTicketSummaryDTO[]
        total: number
        page: number
        pageSize: number
      }>(
        `${BASE}/tickets${search({
          status: query.status,
          q: query.q,
          page: query.page,
          pageSize: query.pageSize,
        })}`,
        undefined,
        'Erro ao carregar seus chamados',
      ),
    retry: false,
  })
}

export function useSdPortalTicket(code: string, enabled = true) {
  return useQuery({
    queryKey: sdPortalKeys.ticket(code),
    queryFn: () =>
      apiFetch<SdPortalTicketDetailDTO>(
        `${BASE}/tickets/${encodeURIComponent(code)}`,
        undefined,
        'Erro ao carregar o chamado',
      ),
    enabled: enabled && code.length > 0,
    retry: false,
  })
}

export function useSdPortalFormOptions(enabled = true) {
  return useQuery({
    queryKey: sdPortalKeys.options,
    queryFn: () =>
      apiFetch<SdPortalFormOptionsDTO>(
        `${BASE}/options`,
        undefined,
        'Erro ao carregar o formulário',
      ),
    enabled,
    retry: false,
    staleTime: 5 * 60_000,
  })
}

export function useCreateSdPortalTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSdPortalTicketDTO) =>
      apiFetch<SdPortalTicketSummaryDTO>(
        `${BASE}/tickets`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        },
        'Não conseguimos abrir seu chamado',
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['sd-portal', 'tickets'] }),
  })
}

export interface SdPortalReplyInput {
  body: string
  files?: File[]
}

/** Resposta do contato no histórico (texto e/ou anexos). */
export function useReplySdPortalTicket(code: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SdPortalReplyInput) => {
      const url = `${BASE}/tickets/${encodeURIComponent(code)}/messages`
      if (input.files && input.files.length > 0) {
        const form = new FormData()
        form.append('body', input.body)
        for (const file of input.files) form.append('files', file)
        return apiFetch<SdPortalMessageDTO>(
          url,
          { method: 'POST', body: form },
          'Não conseguimos enviar sua mensagem',
        )
      }
      return apiFetch<SdPortalMessageDTO>(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: input.body }),
        },
        'Não conseguimos enviar sua mensagem',
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sdPortalKeys.ticket(code) })
      queryClient.invalidateQueries({ queryKey: ['sd-portal', 'tickets'] })
    },
  })
}

/** Avaliação do atendimento (1–5 + comentário), uma única vez. */
export function useRateSdPortalTicket(code: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { score: number; comment?: string }) =>
      apiFetch<{ csatScore: number; csatComment: string | null }>(
        `${BASE}/tickets/${encodeURIComponent(code)}/csat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        },
        'Não conseguimos registrar sua avaliação',
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: sdPortalKeys.ticket(code) }),
  })
}

export function useSdPortalKnowledge(q: string, categoryId?: string) {
  return useQuery({
    queryKey: sdPortalKeys.knowledge(q, categoryId),
    queryFn: () =>
      apiFetch<SdPortalKbListDTO>(
        `${BASE}/knowledge${search({ q, categoryId })}`,
        undefined,
        'Erro ao carregar a base de conhecimento',
      ),
    retry: false,
  })
}

export function useSdPortalArticle(articleId: string | null) {
  return useQuery({
    queryKey: sdPortalKeys.article(articleId ?? ''),
    queryFn: () =>
      apiFetch<SdPortalKbArticleDTO>(
        `${BASE}/knowledge/${encodeURIComponent(articleId ?? '')}`,
        undefined,
        'Erro ao carregar o artigo',
      ),
    enabled: articleId !== null,
    retry: false,
  })
}
