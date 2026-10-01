import type { Prisma } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { ok, type Result } from '@/src/lib/result'
import { sdDb } from './sd-config-db'
import { SD_USER_SUMMARY_SELECT } from './sd-ticket.repository'

/**
 * Leitura das mudanças agendadas para o calendário e para a checagem de
 * conflito. Fica numa função própria desta fatia (não mexe no repositório de
 * chamados): só `SELECT`, sem regra de negócio.
 *
 * "Agendada" = chamado `CHANGE` não excluído com `plannedStartAt` e
 * `plannedEndAt` preenchidos. Fases finais que não valem mais como ocupação
 * da janela (`CLOSED`, `CANCELED`) entram no calendário mas ficam fora da
 * checagem de conflito.
 */

const CHANGE_SELECT = {
  id: true,
  number: true,
  type: true,
  title: true,
  plannedStartAt: true,
  plannedEndAt: true,
  changeType: true,
  changeRisk: true,
  configItemId: true,
  departmentId: true,
  phase: { select: { id: true, name: true, category: true } },
  configItem: { select: { id: true, name: true } },
  assignee: { select: SD_USER_SUMMARY_SELECT },
} as const satisfies Prisma.SdTicketSelect

export type SdScheduledChange = Prisma.SdTicketGetPayload<{
  select: typeof CHANGE_SELECT
}> & { plannedStartAt: Date; plannedEndAt: Date }

/** Fases que já não disputam a janela. */
const DONE_CATEGORIES = ['CLOSED', 'CANCELED'] as const

/** Mudança não excluída cuja janela planejada cruza `[from, to)`. */
function scheduled(range: { from: Date; to: Date }): Prisma.SdTicketWhereInput {
  return {
    type: 'CHANGE',
    deletedAt: null,
    plannedStartAt: { not: null, lt: range.to },
    plannedEndAt: { not: null, gt: range.from },
  }
}

export const SdChangeScheduleRepository = {
  /** Mudanças cuja janela planejada cruza `[from, to)`. */
  async listInRange(
    workspaceId: string,
    range: { from: Date; to: Date },
  ): Promise<Result<SdScheduledChange[]>> {
    return sdDb('Failed to list ServiceDesk scheduled changes', async () => {
      const rows = await prisma.sdTicket.findMany({
        where: { workspaceId, ...scheduled(range) },
        select: CHANGE_SELECT,
        orderBy: [{ plannedStartAt: 'asc' }, { number: 'asc' }],
      })
      return rows as SdScheduledChange[]
    })
  },

  /**
   * Outras mudanças ativas que disputam o mesmo item de configuração no
   * período. Sem `configItemId` não há conflito a apurar (devolve vazio).
   */
  async findConflicts(params: {
    workspaceId: string
    ticketId: string
    configItemId: string | null
    startsAt: Date
    endsAt: Date
  }): Promise<Result<SdScheduledChange[]>> {
    if (!params.configItemId) return ok([])
    return sdDb('Failed to find ServiceDesk change conflicts', async () => {
      const rows = await prisma.sdTicket.findMany({
        where: {
          workspaceId: params.workspaceId,
          id: { not: params.ticketId },
          configItemId: params.configItemId,
          phase: { category: { notIn: [...DONE_CATEGORIES] } },
          ...scheduled({ from: params.startsAt, to: params.endsAt }),
        },
        select: CHANGE_SELECT,
        orderBy: [{ plannedStartAt: 'asc' }, { number: 'asc' }],
        take: 20,
      })
      return rows as SdScheduledChange[]
    })
  },

  /** Item de configuração do chamado (rótulo do bloco de agenda). */
  async findConfigItemName(id: string): Promise<Result<string | null>> {
    return sdDb('Failed to find ServiceDesk config item', async () => {
      const row = await prisma.sdConfigItem.findUnique({
        where: { id },
        select: { name: true },
      })
      return row?.name ?? null
    })
  },
}
