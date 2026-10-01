import type { Prisma, SdPhaseCategory } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

/**
 * Leituras em massa para as fontes dos dashboards do ServiceDesk (painéis
 * analíticos e modo TV). Só Prisma: o recorte (janela, teto) vem do service
 * e o achatamento/derivação (SLA, MTTR, rótulos) fica no mapper.
 */

const NAME = { select: { name: true } } as const
const LEVEL = { select: { name: true, level: true } } as const
const OPEN_EXCLUDED: SdPhaseCategory[] = ['RESOLVED', 'CLOSED', 'CANCELED']

export const SD_DASHBOARD_TICKET_SELECT = {
  id: true,
  number: true,
  type: true,
  title: true,
  channel: true,
  completionPercent: true,
  assigneeId: true,
  escalationLevel: true,
  tags: true,
  customFields: true,
  firstResponseDueAt: true,
  resolutionDueAt: true,
  firstRespondedAt: true,
  slaPausedAt: true,
  slaPausedMinutes: true,
  firstResponseBreached: true,
  resolutionBreached: true,
  resolvedAt: true,
  closedAt: true,
  reopenCount: true,
  csatScore: true,
  lastActivityAt: true,
  createdAt: true,
  phase: { select: { name: true, category: true } },
  priority: LEVEL,
  severity: LEVEL,
  impact: LEVEL,
  urgency: LEVEL,
  department: NAME,
  assignee: NAME,
  requester: NAME,
  customer: NAME,
  company: NAME,
  contact: NAME,
  category: NAME,
  subcategory: NAME,
  service: NAME,
  classification: NAME,
  solutionClassification: NAME,
  slaPolicy: {
    select: {
      calendar: {
        select: {
          timezone: true,
          schedule: true,
          holidays: true,
          is24x7: true,
        },
      },
    },
  },
} as const satisfies Prisma.SdTicketSelect

export type SdDashboardTicket = Prisma.SdTicketGetPayload<{
  select: typeof SD_DASHBOARD_TICKET_SELECT
}>

const TICKET_REF = {
  select: {
    number: true,
    type: true,
    title: true,
    category: NAME,
    priority: NAME,
    department: NAME,
    customer: NAME,
  },
} as const

export const SD_DASHBOARD_COST_SELECT = {
  id: true,
  ticketId: true,
  category: true,
  description: true,
  quantity: true,
  unitCost: true,
  billable: true,
  incurredAt: true,
  createdAt: true,
  user: NAME,
  ticket: TICKET_REF,
} as const satisfies Prisma.SdTicketCostSelect

export type SdDashboardCost = Prisma.SdTicketCostGetPayload<{
  select: typeof SD_DASHBOARD_COST_SELECT
}>

export const SD_DASHBOARD_EVENT_SELECT = {
  id: true,
  ticketId: true,
  actorKind: true,
  action: true,
  meta: true,
  createdAt: true,
  actor: NAME,
  ticket: TICKET_REF,
} as const satisfies Prisma.SdTicketEventSelect

export type SdDashboardEvent = Prisma.SdTicketEventGetPayload<{
  select: typeof SD_DASHBOARD_EVENT_SELECT
}>

export const SD_DASHBOARD_KB_SELECT = {
  id: true,
  title: true,
  status: true,
  visibility: true,
  tags: true,
  viewCount: true,
  helpfulCount: true,
  notHelpfulCount: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  category: NAME,
  createdBy: NAME,
} as const satisfies Prisma.SdKbArticleSelect

export type SdDashboardKbArticle = Prisma.SdKbArticleGetPayload<{
  select: typeof SD_DASHBOARD_KB_SELECT
}>

/** Ações de rastreabilidade que interessam aos painéis (fluxo/volume). */
export const SD_DASHBOARD_EVENT_ACTIONS = [
  'ticket.created',
  'phase.changed',
  'ticket.reopened',
  'ticket.auto_closed',
  'escalated',
  'sla.at_risk',
  'sla.first_response_breached',
  'sla.resolution_breached',
  'csat.submitted',
] as const

export interface SdDashboardContext {
  ticketPrefixes: Prisma.JsonValue | null
  slaAtRiskPercent: number
  /** Maior peso de prioridade do workspace (`null` sem prioridades). */
  topPriorityLevel: number | null
}

export const SdDashboardSourceRepository = {
  /** Prefixos, % de risco do SLA e a prioridade mais alta do workspace. */
  async context(workspaceId: string): Promise<Result<SdDashboardContext>> {
    try {
      const [settings, top] = await Promise.all([
        prisma.sdSettings.findUnique({
          where: { workspaceId },
          select: { ticketPrefixes: true, slaAtRiskPercent: true },
        }),
        prisma.sdPriority.aggregate({
          where: { workspaceId },
          _max: { level: true },
        }),
      ])
      return ok({
        ticketPrefixes: settings?.ticketPrefixes ?? null,
        slaAtRiskPercent: settings?.slaAtRiskPercent ?? 80,
        topPriorityLevel: top._max.level ?? null,
      })
    } catch (error) {
      return err(dbError('Failed to load the SD dashboard context', error))
    }
  },

  /**
   * Chamados não excluídos: todos os em aberto + os criados, resolvidos ou
   * fechados desde `since`. Mais recentes primeiro, até `limit`.
   */
  async listTickets(
    workspaceId: string,
    since: Date,
    limit: number,
  ): Promise<Result<SdDashboardTicket[]>> {
    try {
      const tickets = await prisma.sdTicket.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          OR: [
            { phase: { category: { notIn: OPEN_EXCLUDED } } },
            { createdAt: { gte: since } },
            { resolvedAt: { gte: since } },
            { closedAt: { gte: since } },
          ],
        },
        select: SD_DASHBOARD_TICKET_SELECT,
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
      return ok(tickets)
    } catch (error) {
      return err(dbError('Failed to list SD dashboard tickets', error))
    }
  },

  /** Custos lançados desde `since` em chamados não excluídos. */
  async listCosts(
    workspaceId: string,
    since: Date,
    limit: number,
  ): Promise<Result<SdDashboardCost[]>> {
    try {
      const costs = await prisma.sdTicketCost.findMany({
        where: {
          workspaceId,
          incurredAt: { gte: since },
          ticket: { deletedAt: null },
        },
        select: SD_DASHBOARD_COST_SELECT,
        orderBy: { incurredAt: 'desc' },
        take: limit,
      })
      return ok(costs)
    } catch (error) {
      return err(dbError('Failed to list SD dashboard costs', error))
    }
  },

  /** Eventos de fluxo (criação, fase, reabertura, SLA…) desde `since`. */
  async listEvents(
    workspaceId: string,
    since: Date,
    limit: number,
  ): Promise<Result<SdDashboardEvent[]>> {
    try {
      const events = await prisma.sdTicketEvent.findMany({
        where: {
          workspaceId,
          createdAt: { gte: since },
          action: { in: [...SD_DASHBOARD_EVENT_ACTIONS] },
          ticket: { deletedAt: null },
        },
        select: SD_DASHBOARD_EVENT_SELECT,
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
      return ok(events)
    } catch (error) {
      return err(dbError('Failed to list SD dashboard events', error))
    }
  },

  /** Artigos não arquivados da base de conhecimento. */
  async listKbArticles(
    workspaceId: string,
    limit: number,
  ): Promise<Result<SdDashboardKbArticle[]>> {
    try {
      const articles = await prisma.sdKbArticle.findMany({
        where: { workspaceId, archivedAt: null },
        select: SD_DASHBOARD_KB_SELECT,
        orderBy: { viewCount: 'desc' },
        take: limit,
      })
      return ok(articles)
    } catch (error) {
      return err(dbError('Failed to list SD dashboard KB articles', error))
    }
  },
}
