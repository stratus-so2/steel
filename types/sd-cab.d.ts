import type { SdCondition } from '@/src/schemas/sd-rule.schema'
import type { SdTicketApprovalDTO } from './sd-ticket-approval'
import type { SdUserSummaryDTO } from './sd-ticket'

/**
 * Comitê de mudanças (CAB) e a rodada de aprovação: o comitê define quem vota
 * e quantos votos bastam; a rodada agrupa os pedidos
 * (`SdTicketApproval.roundId`) de um disparo e guarda o quórum aplicado.
 */

export interface SdCabMemberDTO {
  id: string
  userId: string
  user: SdUserSummaryDTO | null
  /** Voto obrigatório: a rodada não fecha sem ele, mesmo com quórum. */
  required: boolean
}

export interface SdCabBoardDTO {
  id: string
  name: string
  description: string | null
  /** Como está salvo (0 = todos os membros). */
  quorum: number
  /** Quantos votos de fato fecham a rodada hoje (0 → nº de membros). */
  effectiveQuorum: number
  rejectEnds: boolean
  conditions: SdCondition[]
  active: boolean
  position: number
  members: SdCabMemberDTO[]
  createdAt: string
  updatedAt: string
}

export type SdApprovalRoundStatusDTO =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELED'
  | 'EXPIRED'

/** Contagem de votos da rodada. */
export interface SdApprovalRoundTallyDTO {
  total: number
  approved: number
  rejected: number
  pending: number
  /** Votos obrigatórios ainda pendentes. */
  requiredPending: number
  /** Quantas aprovações faltam para o quórum (0 = atingido). */
  remaining: number
}

export interface SdApprovalRoundDTO {
  id: string
  ticketId: string
  boardId: string | null
  boardName: string | null
  status: SdApprovalRoundStatusDTO
  quorum: number
  rejectEnds: boolean
  requestedBy: SdUserSummaryDTO | null
  decidedAt: string | null
  createdAt: string
  updatedAt: string
  approvals: SdTicketApprovalDTO[]
  tally: SdApprovalRoundTallyDTO
}
