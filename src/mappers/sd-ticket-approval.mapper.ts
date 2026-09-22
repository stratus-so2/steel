import { sdHtmlToText } from '@/src/lib/servicedesk/html'
import type {
  SdTicketApprovalWithRelations,
  SdTicketApprovalWithTicket,
} from '@/src/repositories/sd-ticket-approval.repository'
import type {
  SdPublicApprovalDTO,
  SdTicketApprovalDTO,
} from '@/types/sd-ticket-approval'

/** Tamanho máximo do resumo do chamado na página pública. */
export const SD_PUBLIC_SUMMARY_MAX = 500

export function toSdTicketApprovalDTO(
  row: SdTicketApprovalWithRelations,
): SdTicketApprovalDTO {
  return {
    id: row.id,
    ticketId: row.ticketId,
    approverName: row.approverName,
    approverEmail: row.approverEmail,
    approver: row.approver,
    status: row.status,
    message: row.message,
    comment: row.comment,
    requestedBy: row.requestedBy,
    sentAt: row.sentAt?.toISOString() ?? null,
    respondedAt: row.respondedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function summarize(html: string | null): string | null {
  if (!html) return null
  const text = sdHtmlToText(html).trim()
  if (!text) return null
  return text.length > SD_PUBLIC_SUMMARY_MAX
    ? `${text.slice(0, SD_PUBLIC_SUMMARY_MAX - 1).trimEnd()}…`
    : text
}

/**
 * Resumo público (sem sessão): só código, título, tipo, fase e a descrição
 * em texto — nada de campos internos (notas, custos, responsáveis).
 */
export function toSdPublicApprovalDTO(
  row: SdTicketApprovalWithTicket,
  code: string,
): SdPublicApprovalDTO {
  return {
    status: row.status,
    workspaceName: row.workspace.name,
    approverName: row.approverName,
    requestedByName: row.requestedBy?.name ?? null,
    message: row.message,
    comment: row.comment,
    expiresAt: row.expiresAt.toISOString(),
    respondedAt: row.respondedAt?.toISOString() ?? null,
    ticket: {
      code,
      title: row.ticket.title,
      type: row.ticket.type,
      phaseName: row.ticket.phase.name,
      summary: summarize(row.ticket.description),
    },
  }
}
