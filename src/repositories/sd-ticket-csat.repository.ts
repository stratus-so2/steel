import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const SdTicketCsatRepository = {
  /**
   * Grava a avaliação só se o chamado ainda não tiver uma (condição atômica
   * no `WHERE`: duas respostas simultâneas não se sobrescrevem). `true` =
   * gravou; `false` = já havia avaliação (ou o chamado sumiu).
   */
  async submit(
    ticketId: string,
    workspaceId: string,
    score: number,
    comment: string | null,
  ): Promise<Result<boolean>> {
    try {
      const result = await prisma.sdTicket.updateMany({
        where: { id: ticketId, workspaceId, deletedAt: null, csatScore: null },
        data: { csatScore: score, csatComment: comment },
      })
      return ok(result.count === 1)
    } catch (error) {
      return err(dbError('Failed to submit SD ticket CSAT', error))
    }
  },
}
