import type { SdTicketWithRelations } from '@/src/repositories/sd-ticket.repository'

/**
 * Quem vê um chamado: agentes (e admins) veem todos; solicitantes só os
 * chamados em que são solicitante, participante ou o usuário do contato
 * vinculado. Espelha `sdRequesterScope` (filtro de listagem).
 */
export function canViewSdTicket(
  viewer: { userId: string; isAgent: boolean },
  ticket: Pick<
    SdTicketWithRelations,
    'requesterId' | 'participants' | 'contact'
  >,
): boolean {
  if (viewer.isAgent) return true
  return (
    ticket.requesterId === viewer.userId ||
    ticket.participants.some((p) => p.userId === viewer.userId) ||
    ticket.contact?.userId === viewer.userId
  )
}
