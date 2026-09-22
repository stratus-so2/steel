import type { Prisma, SdTicketEscalation } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'
import { SD_USER_SUMMARY_SELECT } from './sd-ticket.repository'

export type SdTicketEscalationWithActor = Prisma.SdTicketEscalationGetPayload<{
  include: { createdBy: { select: typeof SD_USER_SUMMARY_SELECT } }
}>

export const SdTicketEscalationRepository = {
  async create(
    data: Prisma.SdTicketEscalationUncheckedCreateInput,
  ): Promise<Result<SdTicketEscalationWithActor>> {
    try {
      const row = await prisma.sdTicketEscalation.create({
        data,
        include: { createdBy: { select: SD_USER_SUMMARY_SELECT } },
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to create ServiceDesk escalation', error))
    }
  },

  async listByTicket(
    ticketId: string,
  ): Promise<Result<SdTicketEscalationWithActor[]>> {
    try {
      const rows = await prisma.sdTicketEscalation.findMany({
        where: { ticketId },
        include: { createdBy: { select: SD_USER_SUMMARY_SELECT } },
        orderBy: { createdAt: 'desc' },
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk escalations', error))
    }
  },

  /** Última escalada automática desta regra neste chamado (idempotência). */
  async findLatestByRule(
    ticketId: string,
    ruleId: string,
  ): Promise<Result<SdTicketEscalation | null>> {
    try {
      const row = await prisma.sdTicketEscalation.findFirst({
        where: { ticketId, ruleId },
        orderBy: { createdAt: 'desc' },
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk escalation', error))
    }
  },
}
