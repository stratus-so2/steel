import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CreateSdMailboxDTO,
  UpdateSdMailboxDTO,
} from '@/src/schemas/sd-mailbox.schema'
import type {
  SdMailboxDTO,
  SdMailboxSyncDTO,
  SdMailboxTestDTO,
  SdTicketMailMessageDTO,
} from '@/types/sd-mailbox'
import { apiFetch, apiSend } from './_fetch'

/**
 * Canal de e-mail do ServiceDesk: as caixas monitoradas (tela de
 * configurações, só admins) e os e-mails de um chamado (marcador do
 * histórico).
 *
 * A chave dos e-mails do chamado começa com `['sd-tickets', workspaceId,
 * …]` para o SSE do chamado (`useSdTicketRealtime`) recarregá-la junto com
 * as mensagens.
 */

const base = (workspaceId: string) =>
  `/api/workspaces/${workspaceId}/servicedesk/mailboxes`

function json(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }
}

export const sdMailboxKeys = {
  all: (ws: string) => ['sd-mailboxes', ws] as const,
  ticketMail: (ws: string, ref: string) =>
    ['sd-tickets', ws, 'mail-messages', ref] as const,
}

export function useSdMailboxes(
  workspaceId: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: sdMailboxKeys.all(workspaceId),
    queryFn: () =>
      apiFetch<SdMailboxDTO[]>(
        base(workspaceId),
        undefined,
        'Erro ao carregar as caixas de e-mail',
      ),
    enabled: Boolean(workspaceId) && options.enabled !== false,
  })
}

function useInvalidateMailboxes(workspaceId: string) {
  const qc = useQueryClient()
  return () =>
    qc.invalidateQueries({ queryKey: sdMailboxKeys.all(workspaceId) })
}

export function useCreateSdMailbox(workspaceId: string) {
  const invalidate = useInvalidateMailboxes(workspaceId)
  return useMutation({
    mutationFn: (input: CreateSdMailboxDTO) =>
      apiFetch<SdMailboxDTO>(
        base(workspaceId),
        json('POST', input),
        'Erro ao cadastrar a caixa de e-mail',
      ),
    onSuccess: invalidate,
  })
}

export function useUpdateSdMailbox(workspaceId: string) {
  const invalidate = useInvalidateMailboxes(workspaceId)
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSdMailboxDTO }) =>
      apiFetch<SdMailboxDTO>(
        `${base(workspaceId)}/${id}`,
        json('PATCH', data),
        'Erro ao salvar a caixa de e-mail',
      ),
    onSuccess: invalidate,
  })
}

export function useDeleteSdMailbox(workspaceId: string) {
  const invalidate = useInvalidateMailboxes(workspaceId)
  return useMutation({
    mutationFn: (id: string) =>
      apiSend(
        `${base(workspaceId)}/${id}`,
        { method: 'DELETE' },
        'Erro ao remover a caixa de e-mail',
      ),
    onSuccess: invalidate,
  })
}

/** Testa IMAP (e SMTP, se houver) e atualiza o status da caixa. */
export function useTestSdMailbox(workspaceId: string) {
  const invalidate = useInvalidateMailboxes(workspaceId)
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<SdMailboxTestDTO>(
        `${base(workspaceId)}/${id}/test`,
        { method: 'POST' },
        'Erro ao testar a caixa de e-mail',
      ),
    onSuccess: invalidate,
  })
}

/** Lê a caixa agora, sem esperar o tick de 1 minuto. */
export function useSyncSdMailbox(workspaceId: string) {
  const invalidate = useInvalidateMailboxes(workspaceId)
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<SdMailboxSyncDTO>(
        `${base(workspaceId)}/${id}/sync`,
        { method: 'POST' },
        'Erro ao ler a caixa de e-mail',
      ),
    onSuccess: invalidate,
  })
}

/** E-mails de um chamado, indexados pela mensagem do histórico. */
export function useSdTicketMail(
  workspaceId: string,
  ticketRef: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: sdMailboxKeys.ticketMail(workspaceId, ticketRef),
    queryFn: () =>
      apiFetch<SdTicketMailMessageDTO[]>(
        `/api/workspaces/${workspaceId}/servicedesk/mail/tickets/${encodeURIComponent(ticketRef)}/messages`,
        undefined,
        'Erro ao carregar os e-mails do chamado',
      ),
    enabled: Boolean(workspaceId && ticketRef) && options.enabled !== false,
  })
}

/** `ticketMessageId` → e-mail, para o histórico marcar cada mensagem. */
export function indexSdTicketMail(
  rows: SdTicketMailMessageDTO[] | undefined,
): Map<string, SdTicketMailMessageDTO> {
  const map = new Map<string, SdTicketMailMessageDTO>()
  for (const row of rows ?? []) {
    if (row.ticketMessageId) map.set(row.ticketMessageId, row)
  }
  return map
}
