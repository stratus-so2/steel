import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const SdTicketParticipantRepository = {
  /** Adiciona (idempotente). Devolve `true` se o vínculo é novo. */
  async add(
    ticketId: string,
    userId: string,
    addedById: string | null,
  ): Promise<Result<boolean>> {
    try {
      const result = await prisma.sdTicketParticipant.createMany({
        data: [{ ticketId, userId, addedById }],
        skipDuplicates: true,
      })
      return ok(result.count > 0)
    } catch (error) {
      return err(dbError('Failed to add ServiceDesk participant', error))
    }
  },

  /** Remove. Devolve `true` se existia. */
  async remove(ticketId: string, userId: string): Promise<Result<boolean>> {
    try {
      const result = await prisma.sdTicketParticipant.deleteMany({
        where: { ticketId, userId },
      })
      return ok(result.count > 0)
    } catch (error) {
      return err(dbError('Failed to remove ServiceDesk participant', error))
    }
  },
}
