import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  SdAiPreServiceCloseDTO,
  SdAiPreServiceMessageDTO,
  SdAiPreServiceOpenTicketDTO,
  SdAiReplyRequestDTO,
} from '@/src/schemas/sd-ai.schema'
import type {
  SdAiClassificationDTO,
  SdAiConversationDTO,
  SdAiOpenedTicketDTO,
  SdAiPreServiceReplyDTO,
  SdAiTextDTO,
} from '@/types/sd-ai'
import { apiFetch, apiSend, isApiErrorCode } from './_fetch'

/**
 * Agente de IA do ServiceDesk: copiloto do agente na tela do chamado
 * (resumo, sugestão de resposta, classificação, solução e conversa livre) e
 * o pré-atendimento do solicitante no portal.
 *
 * As respostas do provedor demoram alguns segundos e consomem cota, então
 * tudo é mutação sob demanda — nada é buscado sozinho. A única leitura é o
 * histórico da conversa do copiloto.
 */

const base = (workspaceId: string) =>
  `/api/workspaces/${workspaceId}/servicedesk/ai`

const ticketUrl = (workspaceId: string, ticketRef: string) =>
  `${base(workspaceId)}/tickets/${encodeURIComponent(ticketRef)}`

function json(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }
}

export const sdAiKeys = {
  all: (ws: string) => ['sd-ai', ws] as const,
  chat: (ws: string, ref: string) => ['sd-ai', ws, 'chat', ref] as const,
}

/** A IA do ServiceDesk está desligada nas configurações do módulo. */
export function isSdAiDisabled(error: unknown): boolean {
  return isApiErrorCode(error, 'SD_AI_DISABLED', 'SD_PORTAL_DISABLED')
}

/** A cota mensal de IA do workspace acabou (ADR 0007). */
export function isSdAiQuotaExceeded(error: unknown): boolean {
  return isApiErrorCode(error, 'AI_QUOTA_EXCEEDED')
}

/** Mensagem amigável para os erros que o usuário pode resolver. */
export function sdAiErrorHint(error: unknown): string | null {
  if (isSdAiDisabled(error)) {
    return 'O agente de IA está desativado nas configurações do ServiceDesk.'
  }
  if (isSdAiQuotaExceeded(error)) {
    return 'A cota mensal de IA do workspace acabou. Fale com um administrador.'
  }
  if (isApiErrorCode(error, 'AI_PROVIDER_UNAVAILABLE')) {
    return 'O provedor de IA não respondeu. Tente novamente em instantes.'
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Copiloto (agentes)                                                   */
/* ------------------------------------------------------------------ */

function useInvalidateTicket(workspaceId: string) {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['sd-tickets', workspaceId] })
}

/** Resume o chamado e grava o resumo em `aiSummary`. */
export function useSdAiSummary(workspaceId: string, ticketRef: string) {
  const invalidate = useInvalidateTicket(workspaceId)
  return useMutation({
    mutationFn: () =>
      apiFetch<SdAiTextDTO>(
        `${ticketUrl(workspaceId, ticketRef)}/summary`,
        { method: 'POST' },
        'Erro ao resumir o chamado',
      ),
    onSuccess: invalidate,
  })
}

/** Sugere a próxima resposta pública (o agente revisa antes de enviar). */
export function useSdAiSuggestReply(workspaceId: string, ticketRef: string) {
  return useMutation({
    mutationFn: (input: SdAiReplyRequestDTO = {}) =>
      apiFetch<SdAiTextDTO>(
        `${ticketUrl(workspaceId, ticketRef)}/reply`,
        json('POST', input),
        'Erro ao sugerir a resposta',
      ),
  })
}

/** Rascunho do campo "Solução". */
export function useSdAiSolution(workspaceId: string, ticketRef: string) {
  return useMutation({
    mutationFn: () =>
      apiFetch<SdAiTextDTO>(
        `${ticketUrl(workspaceId, ticketRef)}/solution`,
        { method: 'POST' },
        'Erro ao rascunhar a solução',
      ),
  })
}

/** Sugestão de classificação (catálogo, prioridade, departamento, tags). */
export function useSdAiClassification(workspaceId: string, ticketRef: string) {
  return useMutation({
    mutationFn: () =>
      apiFetch<SdAiClassificationDTO>(
        `${ticketUrl(workspaceId, ticketRef)}/classification`,
        { method: 'POST' },
        'Erro ao sugerir a classificação',
      ),
  })
}

/** Conversa do copiloto deste agente neste chamado (`null` = nenhuma). */
export function useSdAiChat(
  workspaceId: string,
  ticketRef: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: sdAiKeys.chat(workspaceId, ticketRef),
    queryFn: () =>
      apiFetch<SdAiConversationDTO | null>(
        `${ticketUrl(workspaceId, ticketRef)}/chat`,
        undefined,
        'Erro ao carregar a conversa com o copiloto',
      ),
    enabled: Boolean(workspaceId && ticketRef) && options.enabled !== false,
  })
}

export function useSendSdAiChat(workspaceId: string, ticketRef: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (message: string) =>
      apiFetch<SdAiConversationDTO>(
        `${ticketUrl(workspaceId, ticketRef)}/chat`,
        json('POST', { message }),
        'Erro ao falar com o copiloto',
      ),
    onSuccess: (conversation) =>
      qc.setQueryData(sdAiKeys.chat(workspaceId, ticketRef), conversation),
  })
}

export function useResetSdAiChat(workspaceId: string, ticketRef: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiSend(
        `${ticketUrl(workspaceId, ticketRef)}/chat`,
        { method: 'DELETE' },
        'Erro ao limpar a conversa',
      ),
    onSuccess: () =>
      qc.setQueryData(sdAiKeys.chat(workspaceId, ticketRef), null),
  })
}

/* ------------------------------------------------------------------ */
/* Pré-atendimento (portal do solicitante)                              */
/* ------------------------------------------------------------------ */

/** Uma mensagem do solicitante; a resposta traz o turno completo da IA. */
export function useSdPreServiceMessage(workspaceId: string) {
  return useMutation({
    mutationFn: (input: SdAiPreServiceMessageDTO) =>
      apiFetch<SdAiPreServiceReplyDTO>(
        `${base(workspaceId)}/pre-service`,
        json('POST', input),
        'Erro ao falar com o assistente',
      ),
  })
}

/** "Abrir chamado" ao fim do pré-atendimento (usa o rascunho da IA). */
export function useSdPreServiceOpenTicket(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      conversationId,
      ...input
    }: SdAiPreServiceOpenTicketDTO & { conversationId: string }) =>
      apiFetch<SdAiOpenedTicketDTO>(
        `${base(workspaceId)}/pre-service/${encodeURIComponent(conversationId)}/ticket`,
        json('POST', input),
        'Erro ao abrir o chamado',
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['sd-tickets', workspaceId] }),
  })
}

/** Encerra sem chamado: resolvido pela base ou desistência. */
export function useSdPreServiceClose(workspaceId: string) {
  return useMutation({
    mutationFn: ({
      conversationId,
      outcome,
    }: SdAiPreServiceCloseDTO & { conversationId: string }) =>
      apiFetch<SdAiConversationDTO>(
        `${base(workspaceId)}/pre-service/${encodeURIComponent(conversationId)}/close`,
        json('POST', { outcome }),
        'Erro ao encerrar o atendimento',
      ),
  })
}
