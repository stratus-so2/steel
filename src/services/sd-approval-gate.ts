import { ok, type Result } from '@/src/lib/result'
import { SdApprovalRoundRepository } from '@/src/repositories/sd-approval-round.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'

/**
 * A exigência de aprovação da fase (`SdPhase.requiresApproval`) é satisfeita
 * por **duas** vias:
 *
 * 1. uma **rodada do comitê** (CAB) aprovada — qualquer rodada `APPROVED` do
 *    chamado serve;
 * 2. o **pedido avulso** mais recente (sem rodada) estar `APPROVED` — a regra
 *    original, mantida intacta para quem não usa comitê.
 *
 * Os pedidos de uma rodada não contam isoladamente: quem decide por eles é a
 * rodada (quórum, membros obrigatórios, `rejectEnds`). Fica num gancho próprio
 * para o motor (`SdTicketEngine.changePhase`) encostar numa linha.
 */
export async function sdTicketApprovalSatisfied(
  ticketId: string,
): Promise<Result<boolean>> {
  const round = await SdApprovalRoundRepository.hasApprovedRound(ticketId)
  if (!round.ok) return round
  if (round.value) return ok(true)

  const standalone =
    await SdTicketContextRepository.findLatestStandaloneApprovalStatus(ticketId)
  if (!standalone.ok) return standalone
  return ok(standalone.value === 'APPROVED')
}
