import type { Prisma, SdMessageAuthorKind } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'
import { SD_USER_SUMMARY_SELECT } from './sd-ticket.repository'

export interface SdTicketEventInput {
  workspaceId: string
  ticketId: string
  actorKind: SdMessageAuthorKind
  actorUserId?: string | null
  action: string
  field?: string | null
  fromValue?: Prisma.InputJsonValue | null
  toValue?: Prisma.InputJsonValue | null
  meta?: Prisma.InputJsonValue | null
}

export type SdTicketEventWithActor = Prisma.SdTicketEventGetPayload<{
  include: { actor: { select: typeof SD_USER_SUMMARY_SELECT } }
}>

function toRow(e: SdTicketEventInput): Prisma.SdTicketEventCreateManyInput {
  return {
    workspaceId: e.workspaceId,
    ticketId: e.ticketId,
    actorKind: e.actorKind,
    actorUserId: e.actorUserId ?? null,
    action: e.action,
    field: e.field ?? null,
    fromValue: e.fromValue ?? undefined,
    toValue: e.toValue ?? undefined,
    meta: e.meta ?? undefined,
  }
}

export const SdTicketEventRepository = {
  async createMany(events: SdTicketEventInput[]): Promise<Result<number>> {
    if (events.length === 0) return ok(0)
    try {
      const result = await prisma.sdTicketEvent.createMany({
        data: events.map(toRow),
      })
      return ok(result.count)
    } catch (error) {
      return err(dbError('Failed to record ServiceDesk ticket events', error))
    }
  },

  /** Mais recentes primeiro, paginado por cursor (id do último item). */
  async listByTicket(
    ticketId: string,
    params: { cursor?: string; limit: number },
  ): Promise<
    Result<{ items: SdTicketEventWithActor[]; nextCursor: string | null }>
  > {
    try {
      const rows = await prisma.sdTicketEvent.findMany({
        where: { ticketId },
        include: { actor: { select: SD_USER_SUMMARY_SELECT } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: params.limit + 1,
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      })
      const hasMore = rows.length > params.limit
      const items = hasMore ? rows.slice(0, params.limit) : rows
      return ok({
        items,
        nextCursor: hasMore ? items[items.length - 1].id : null,
      })
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk ticket events', error))
    }
  },
}
