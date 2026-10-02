import type { SdTicketType } from '@prisma/client'
import { logger } from '@/lib/axiom/logger'
import { SdContractRepository } from '@/src/repositories/sd-contract.repository'

/**
 * Gancho da fatia de **contratos e horas** no caminho de criação (e na troca
 * de cliente) do `SdTicketEngine`: carimba em `SdTicket.contractId` o
 * contrato vigente do cliente que cobre o tipo do chamado.
 *
 * Nunca lança nem interrompe a abertura do chamado: sem cliente, sem
 * contrato vigente — ou com falha de consulta — o chamado nasce sem contrato
 * e o apontamento de horas fica apenas como registro de tempo, sem valor.
 */
export async function resolveSdTicketContractId(
  workspaceId: string,
  customerId: string | null | undefined,
  type: SdTicketType,
  at: Date,
): Promise<string | null> {
  if (!customerId) return null
  const found = await SdContractRepository.findActiveForCustomer(
    workspaceId,
    customerId,
    type,
    at,
  )
  if (!found.ok) {
    logger.warn('servicedesk.contract.stamp_failed', {
      workspaceId,
      customerId,
      type,
      code: found.error.code,
    })
    return null
  }
  return found.value?.id ?? null
}
