import type { SdTicketTypeDTO, SdUserSummaryDTO } from './sd-ticket'

export type SdApprovalStatusDTO =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELED'
  | 'EXPIRED'

export interface SdTicketApprovalDTO {
  id: string
  ticketId: string
  approverName: string | null
  approverEmail: string
  /** Usuário do workspace (`null` = e-mail externo). */
  approver: SdUserSummaryDTO | null
  status: SdApprovalStatusDTO
  message: string | null
  /** Comentário do aprovador. */
  comment: string | null
  requestedBy: SdUserSummaryDTO | null
  sentAt: string | null
  respondedAt: string | null
  expiresAt: string
  createdAt: string
  updatedAt: string
}

/** Resumo exibido na página pública `/servicedesk/approval/<token>`. */
export interface SdPublicApprovalDTO {
  status: SdApprovalStatusDTO
  workspaceName: string
  approverName: string | null
  requestedByName: string | null
  message: string | null
  comment: string | null
  expiresAt: string
  respondedAt: string | null
  ticket: {
    code: string
    title: string
    type: SdTicketTypeDTO
    phaseName: string
    /** Descrição em texto puro, truncada. */
    summary: string | null
  }
}
