import { toSdTicketApprovalDTO } from '@/src/mappers/sd-ticket-approval.mapper'
import type { SdApprovalRoundWithRelations } from '@/src/repositories/sd-approval-round.repository'
import type {
  SdApprovalRoundDTO,
  SdApprovalRoundTallyDTO,
} from '@/types/sd-cab'

/**
 * `SdApprovalRound` → DTO, com a **contagem de votos** que a tela do chamado
 * mostra ("2 de 3, faltam 1"). `quorum` já vem resolvido do service (o `0` do
 * comitê, que significa "todos", é convertido na abertura da rodada), então
 * aqui é só aritmética.
 */

/** Conta os votos da rodada. */
export function sdApprovalRoundTally(
  round: SdApprovalRoundWithRelations,
): SdApprovalRoundTallyDTO {
  const requiredUserIds = new Set(
    (round.board?.members ?? [])
      .filter((member) => member.required)
      .map((member) => member.userId),
  )
  let approved = 0
  let rejected = 0
  let pending = 0
  let requiredPending = 0
  for (const approval of round.approvals) {
    if (approval.status === 'APPROVED') approved += 1
    else if (approval.status === 'REJECTED') rejected += 1
    else if (approval.status === 'PENDING') {
      pending += 1
      if (
        approval.approverUserId &&
        requiredUserIds.has(approval.approverUserId)
      ) {
        requiredPending += 1
      }
    }
  }
  return {
    total: round.approvals.length,
    approved,
    rejected,
    pending,
    requiredPending,
    remaining: Math.max(0, round.quorum - approved),
  }
}

export function toSdApprovalRoundDTO(
  round: SdApprovalRoundWithRelations,
): SdApprovalRoundDTO {
  return {
    id: round.id,
    ticketId: round.ticketId,
    boardId: round.boardId,
    boardName: round.board?.name ?? null,
    status: round.status,
    quorum: round.quorum,
    rejectEnds: round.rejectEnds,
    requestedBy: round.requestedBy,
    decidedAt: round.decidedAt?.toISOString() ?? null,
    createdAt: round.createdAt.toISOString(),
    updatedAt: round.updatedAt.toISOString(),
    approvals: round.approvals.map(toSdTicketApprovalDTO),
    tally: sdApprovalRoundTally(round),
  }
}

/**
 * A rodada já tem tudo para fechar? Devolve o status final ou `null` para
 * seguir aberta. Regras: uma reprovação encerra quando `rejectEnds`; o quórum
 * só fecha com todos os votos obrigatórios dados; sem pendentes a rodada
 * fecha com o que houver.
 */
export function sdApprovalRoundOutcome(
  round: SdApprovalRoundWithRelations,
): 'APPROVED' | 'REJECTED' | null {
  const tally = sdApprovalRoundTally(round)
  if (round.rejectEnds && tally.rejected > 0) return 'REJECTED'
  if (tally.remaining === 0 && tally.requiredPending === 0) return 'APPROVED'
  if (tally.pending === 0) return tally.rejected > 0 ? 'REJECTED' : 'APPROVED'
  return null
}
