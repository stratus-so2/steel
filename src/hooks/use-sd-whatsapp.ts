import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CreateWhatsAppConnectionDTO,
  UpdateWhatsAppConnectionDTO,
} from '@/src/schemas/whatsapp-connection.schema'
import type {
  SdTicketWhatsappDTO,
  SdWhatsappConnectionDTO,
  SdWhatsappConnectionTestDTO,
  SdWhatsappConversationDTO,
  SdWhatsappMessageDTO,
  SdWhatsappQrCodeDTO,
  SdWhatsappTemplateDTO,
} from '@/types/sd-whatsapp'
import { apiFetch, apiSend } from './_fetch'

/**
 * WhatsApp do ServiceDesk: a aba do chamado (estado, mensagens, envio,
 * vínculo) e as conexões do módulo (tela de configurações).
 *
 * As chaves da aba começam com `['sd-tickets', workspaceId, …]` para que o
 * SSE do chamado (`useSdTicketRealtime`, que invalida `sdTicketKeys.all`)
 * recarregue a conversa a cada mensagem recebida, igual às demais abas.
 */

const base = (workspaceId: string) =>
  `/api/workspaces/${workspaceId}/servicedesk/whatsapp`

const ticketUrl = (workspaceId: string, ticketRef: string) =>
  `${base(workspaceId)}/tickets/${encodeURIComponent(ticketRef)}`

function json(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }
}

export const sdWhatsappKeys = {
  state: (ws: string, ref: string) =>
    ['sd-tickets', ws, 'whatsapp', ref] as const,
  messages: (ws: string, ref: string) =>
    ['sd-tickets', ws, 'whatsapp-messages', ref] as const,
  templates: (ws: string, ref: string) =>
    ['sd-tickets', ws, 'whatsapp-templates', ref] as const,
  conversations: (ws: string, q: string) =>
    ['sd-tickets', ws, 'whatsapp-conversations', q] as const,
  connections: (ws: string) => ['sd-whatsapp-connections', ws] as const,
  qrCode: (ws: string, connectionId: string) =>
    ['sd-whatsapp-connections', ws, connectionId, 'qr-code'] as const,
}

/* ------------------------------------------------------------------ */
/* Aba do chamado                                                       */
/* ------------------------------------------------------------------ */

/** Estado da aba: conexão ativa, conversa vinculada e janela de 24 h. */
export function useSdTicketWhatsapp(workspaceId: string, ticketRef: string) {
  return useQuery({
    queryKey: sdWhatsappKeys.state(workspaceId, ticketRef),
    queryFn: () =>
      apiFetch<SdTicketWhatsappDTO>(
        ticketUrl(workspaceId, ticketRef),
        undefined,
        'Erro ao carregar o WhatsApp do chamado',
      ),
    enabled: Boolean(workspaceId && ticketRef),
  })
}

/** Mensagens da conversa vinculada (mais recentes primeiro na API). */
export function useSdWhatsappMessages(
  workspaceId: string,
  ticketRef: string,
  options: { enabled?: boolean; limit?: number } = {},
) {
  const limit = options.limit ?? 50
  return useQuery({
    queryKey: sdWhatsappKeys.messages(workspaceId, ticketRef),
    queryFn: () =>
      apiFetch<SdWhatsappMessageDTO[]>(
        `${ticketUrl(workspaceId, ticketRef)}/messages?limit=${limit}`,
        undefined,
        'Erro ao carregar as mensagens do WhatsApp',
      ),
    enabled: Boolean(workspaceId && ticketRef) && options.enabled !== false,
  })
}

/** Modelos aprovados da conexão (único envio fora da janela de 24 h). */
export function useSdWhatsappTemplates(
  workspaceId: string,
  ticketRef: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: sdWhatsappKeys.templates(workspaceId, ticketRef),
    queryFn: () =>
      apiFetch<SdWhatsappTemplateDTO[]>(
        `${ticketUrl(workspaceId, ticketRef)}/templates`,
        undefined,
        'Erro ao carregar os modelos do WhatsApp',
      ),
    enabled: Boolean(workspaceId && ticketRef) && options.enabled !== false,
  })
}

/** Conversas do WhatsApp do ServiceDesk (para vincular ao chamado). */
export function useSdWhatsappConversations(
  workspaceId: string,
  query: string,
  options: { enabled?: boolean } = {},
) {
  const q = query.trim()
  return useQuery({
    queryKey: sdWhatsappKeys.conversations(workspaceId, q),
    queryFn: () =>
      apiFetch<SdWhatsappConversationDTO[]>(
        `${base(workspaceId)}/conversations${q ? `?q=${encodeURIComponent(q)}` : ''}`,
        undefined,
        'Erro ao carregar as conversas do WhatsApp',
      ),
    enabled: Boolean(workspaceId) && options.enabled !== false,
  })
}

function useInvalidateTicket(workspaceId: string) {
  const qc = useQueryClient()
  // Prefixo das abas do chamado: estado, mensagens, modelos e o chamado.
  return () => qc.invalidateQueries({ queryKey: ['sd-tickets', workspaceId] })
}

export function useSendSdWhatsappText(workspaceId: string, ticketRef: string) {
  const invalidate = useInvalidateTicket(workspaceId)
  return useMutation({
    mutationFn: (text: string) =>
      apiFetch<SdWhatsappMessageDTO>(
        `${ticketUrl(workspaceId, ticketRef)}/messages`,
        json('POST', { text }),
        'Erro ao enviar a mensagem',
      ),
    onSuccess: invalidate,
  })
}

export function useSendSdWhatsappMedia(workspaceId: string, ticketRef: string) {
  const invalidate = useInvalidateTicket(workspaceId)
  return useMutation({
    mutationFn: ({ file, caption }: { file: File; caption?: string }) => {
      const form = new FormData()
      form.append('file', file)
      if (caption) form.append('caption', caption)
      return apiFetch<SdWhatsappMessageDTO>(
        `${ticketUrl(workspaceId, ticketRef)}/media`,
        { method: 'POST', body: form },
        'Erro ao enviar o arquivo',
      )
    },
    onSuccess: invalidate,
  })
}

export interface SdWhatsappTemplateSend {
  templateName: string
  language: string
  components?: unknown[]
}

export function useSendSdWhatsappTemplate(
  workspaceId: string,
  ticketRef: string,
) {
  const invalidate = useInvalidateTicket(workspaceId)
  return useMutation({
    mutationFn: (input: SdWhatsappTemplateSend) =>
      apiFetch<SdWhatsappMessageDTO>(
        `${ticketUrl(workspaceId, ticketRef)}/template`,
        json('POST', input),
        'Erro ao enviar o modelo',
      ),
    onSuccess: invalidate,
  })
}

/** Vincula uma conversa existente ao chamado. */
export function useLinkSdWhatsapp(workspaceId: string, ticketRef: string) {
  const invalidate = useInvalidateTicket(workspaceId)
  return useMutation({
    mutationFn: (conversationId: string) =>
      apiFetch<SdTicketWhatsappDTO>(
        `${ticketUrl(workspaceId, ticketRef)}/link`,
        json('POST', { conversationId }),
        'Erro ao vincular a conversa',
      ),
    onSuccess: invalidate,
  })
}

/** Inicia (ou retoma) a conversa com um número e vincula ao chamado. */
export function useStartSdWhatsapp(workspaceId: string, ticketRef: string) {
  const invalidate = useInvalidateTicket(workspaceId)
  return useMutation({
    mutationFn: (waId?: string) =>
      apiFetch<SdTicketWhatsappDTO>(
        `${ticketUrl(workspaceId, ticketRef)}/start`,
        json('POST', waId ? { waId } : {}),
        'Erro ao iniciar a conversa',
      ),
    onSuccess: invalidate,
  })
}

export function useUnlinkSdWhatsapp(workspaceId: string, ticketRef: string) {
  const invalidate = useInvalidateTicket(workspaceId)
  return useMutation({
    mutationFn: () =>
      apiFetch<SdTicketWhatsappDTO>(
        ticketUrl(workspaceId, ticketRef),
        { method: 'DELETE' },
        'Erro ao desvincular a conversa',
      ),
    onSuccess: invalidate,
  })
}

/* ------------------------------------------------------------------ */
/* Conexões do módulo (configurações)                                   */
/* ------------------------------------------------------------------ */

export function useSdWhatsappConnections(
  workspaceId: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: sdWhatsappKeys.connections(workspaceId),
    queryFn: () =>
      apiFetch<SdWhatsappConnectionDTO[]>(
        `${base(workspaceId)}/connections`,
        undefined,
        'Erro ao carregar as conexões do WhatsApp',
      ),
    enabled: Boolean(workspaceId) && options.enabled !== false,
  })
}

function useInvalidateConnections(workspaceId: string) {
  const qc = useQueryClient()
  return () => {
    // As conexões e a configuração (conexão ativa) andam juntas.
    void qc.invalidateQueries({
      queryKey: sdWhatsappKeys.connections(workspaceId),
    })
    return qc.invalidateQueries({ queryKey: ['sd-config', workspaceId] })
  }
}

export function useCreateSdWhatsappConnection(workspaceId: string) {
  const invalidate = useInvalidateConnections(workspaceId)
  return useMutation({
    mutationFn: (input: CreateWhatsAppConnectionDTO) =>
      apiFetch<SdWhatsappConnectionDTO>(
        `${base(workspaceId)}/connections`,
        json('POST', input),
        'Erro ao criar a conexão',
      ),
    onSuccess: invalidate,
  })
}

export function useUpdateSdWhatsappConnection(workspaceId: string) {
  const invalidate = useInvalidateConnections(workspaceId)
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: UpdateWhatsAppConnectionDTO
    }) =>
      apiFetch<SdWhatsappConnectionDTO>(
        `${base(workspaceId)}/connections/${id}`,
        json('PATCH', data),
        'Erro ao salvar a conexão',
      ),
    onSuccess: invalidate,
  })
}

export function useDeleteSdWhatsappConnection(workspaceId: string) {
  const invalidate = useInvalidateConnections(workspaceId)
  return useMutation({
    mutationFn: (id: string) =>
      apiSend(
        `${base(workspaceId)}/connections/${id}`,
        { method: 'DELETE' },
        'Erro ao remover a conexão',
      ),
    onSuccess: invalidate,
  })
}

/** Testa as credenciais no provedor e atualiza o status da conexão. */
export function useTestSdWhatsappConnection(workspaceId: string) {
  const invalidate = useInvalidateConnections(workspaceId)
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<SdWhatsappConnectionTestDTO>(
        `${base(workspaceId)}/connections/${id}/test`,
        { method: 'POST' },
        'Erro ao testar a conexão',
      ),
    onSuccess: invalidate,
  })
}

/** QR code da Z-API (enquanto o diálogo está aberto). */
export function useSdWhatsappConnectionQrCode(
  workspaceId: string,
  connectionId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: sdWhatsappKeys.qrCode(workspaceId, connectionId),
    queryFn: () =>
      apiFetch<SdWhatsappQrCodeDTO>(
        `${base(workspaceId)}/connections/${connectionId}/qr-code`,
        undefined,
        'Erro ao buscar o QR code',
      ),
    enabled: enabled && Boolean(workspaceId && connectionId),
    refetchInterval: (query) =>
      query.state.data?.status === 'connected' ? false : 4000,
  })
}
