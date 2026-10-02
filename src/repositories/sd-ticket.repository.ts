import type {
  Prisma,
  SdPhaseCategory,
  SdRiskLevelPrediction,
  SdTicketChannel,
  SdTicketType,
} from '@prisma/client'
import { sdTicketNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const SD_USER_SUMMARY_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
} as const satisfies Prisma.UserSelect

const LEVEL_SELECT = { id: true, name: true, level: true } as const
const CUSTOMER_SELECT = {
  id: true,
  name: true,
  tradeName: true,
  document: true,
} as const

export const SD_TICKET_INCLUDE = {
  phase: {
    select: {
      id: true,
      name: true,
      color: true,
      category: true,
      completionPercent: true,
      position: true,
      wipLimit: true,
      pausesSla: true,
    },
  },
  impact: { select: LEVEL_SELECT },
  urgency: { select: LEVEL_SELECT },
  priority: { select: { ...LEVEL_SELECT, color: true } },
  severity: { select: { ...LEVEL_SELECT, color: true } },
  category: { select: { id: true, name: true } },
  subcategory: { select: { id: true, name: true } },
  service: { select: { id: true, name: true } },
  classification: { select: { id: true, name: true, color: true } },
  solutionClassification: { select: { id: true, name: true, color: true } },
  customer: { select: CUSTOMER_SELECT },
  company: { select: CUSTOMER_SELECT },
  contact: {
    select: { id: true, name: true, email: true, phone: true, userId: true },
  },
  configItem: { select: { id: true, name: true, code: true } },
  department: { select: { id: true, name: true, color: true } },
  assignee: { select: SD_USER_SUMMARY_SELECT },
  requester: { select: SD_USER_SUMMARY_SELECT },
  createdBy: { select: SD_USER_SUMMARY_SELECT },
  participants: {
    orderBy: { createdAt: 'asc' },
    select: { userId: true, user: { select: SD_USER_SUMMARY_SELECT } },
  },
  parent: { select: { id: true, number: true, title: true, type: true } },
  slaPolicy: {
    select: {
      id: true,
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
  riskPrediction: true,
  _count: { select: { children: { where: { deletedAt: null } } } },
} as const satisfies Prisma.SdTicketInclude

export type SdTicketWithRelations = Prisma.SdTicketGetPayload<{
  include: typeof SD_TICKET_INCLUDE
}>

/** Fases que tiram o chamado da fila (fim do ciclo de atendimento). */
export const SD_CLOSED_PHASE_CATEGORIES: SdPhaseCategory[] = [
  'RESOLVED',
  'CLOSED',
  'CANCELED',
]

const CLOSED_CATEGORIES = SD_CLOSED_PHASE_CATEGORIES

/** Filtros já resolvidos pelo service (sem `me`, códigos já parseados). */
export interface SdTicketFilters {
  types?: SdTicketType[]
  phaseIds?: string[]
  phaseCategories?: SdPhaseCategory[]
  priorityIds?: string[]
  severityIds?: string[]
  impactIds?: string[]
  urgencyIds?: string[]
  departmentIds?: string[]
  assigneeIds?: string[]
  includeUnassigned?: boolean
  requesterId?: string
  /** Chamados em que o usuário é participante. */
  participantId?: string
  customerId?: string
  companyId?: string
  contactId?: string
  configItemId?: string
  categoryId?: string
  subcategoryId?: string
  serviceId?: string
  classificationId?: string
  channel?: SdTicketChannel
  tags?: string[]
  sla?: 'at_risk' | 'breached'
  /** Faixa da previsão de risco (`SdTicketRiskPrediction.level`). */
  riskLevel?: SdRiskLevelPrediction
  createdFrom?: Date
  createdTo?: Date
  dueFrom?: Date
  dueTo?: Date
  /** `null` = só sem pai. */
  parentId?: string | null
  q?: string
  qNumber?: number
  includeClosed?: boolean
  /** Solicitante: só chamados em que é solicitante, participante ou contato. */
  visibleToUserId?: string
}

export type SdTicketSortField =
  | 'createdAt'
  | 'updatedAt'
  | 'lastActivityAt'
  | 'number'
  | 'title'
  | 'priority'
  | 'resolutionDueAt'
  | 'firstResponseDueAt'

export interface SdTicketSort {
  field: SdTicketSortField
  order: 'asc' | 'desc'
}

function breachedWhere(now: Date): Prisma.SdTicketWhereInput {
  return {
    OR: [
      { firstResponseBreached: true },
      { resolutionBreached: true },
      {
        firstRespondedAt: null,
        slaPausedAt: null,
        firstResponseDueAt: { lt: now },
      },
      { resolvedAt: null, slaPausedAt: null, resolutionDueAt: { lt: now } },
    ],
  }
}

/**
 * Complemento de `breachedWhere` escrito em termos positivos: `NOT (...)`
 * em SQL descarta linhas com prazos NULL (lógica de três valores).
 */
function notBreachedWhere(now: Date): Prisma.SdTicketWhereInput {
  return {
    firstResponseBreached: false,
    resolutionBreached: false,
    AND: [
      {
        OR: [
          { firstRespondedAt: { not: null } },
          { slaPausedAt: { not: null } },
          { firstResponseDueAt: null },
          { firstResponseDueAt: { gte: now } },
        ],
      },
      {
        OR: [
          { resolvedAt: { not: null } },
          { slaPausedAt: { not: null } },
          { resolutionDueAt: null },
          { resolutionDueAt: { gte: now } },
        ],
      },
    ],
  }
}

/** Visibilidade de solicitante (README: solicitante, participante, contato). */
export function sdRequesterScope(userId: string): Prisma.SdTicketWhereInput {
  return {
    OR: [
      { requesterId: userId },
      { participants: { some: { userId } } },
      { contact: { userId } },
    ],
  }
}

export function buildSdTicketWhere(
  workspaceId: string,
  f: SdTicketFilters,
  now: Date,
): Prisma.SdTicketWhereInput {
  const and: Prisma.SdTicketWhereInput[] = []
  const where: Prisma.SdTicketWhereInput = { workspaceId, deletedAt: null }

  if (f.types?.length) where.type = { in: f.types }
  if (f.phaseIds?.length) where.phaseId = { in: f.phaseIds }
  if (f.phaseCategories?.length) {
    and.push({ phase: { category: { in: f.phaseCategories } } })
  } else if (!f.includeClosed && !f.phaseIds?.length) {
    and.push({ phase: { category: { notIn: CLOSED_CATEGORIES } } })
  }
  if (f.priorityIds?.length) where.priorityId = { in: f.priorityIds }
  if (f.severityIds?.length) where.severityId = { in: f.severityIds }
  if (f.impactIds?.length) where.impactId = { in: f.impactIds }
  if (f.urgencyIds?.length) where.urgencyId = { in: f.urgencyIds }
  if (f.departmentIds?.length) where.departmentId = { in: f.departmentIds }
  if (f.assigneeIds?.length || f.includeUnassigned) {
    const or: Prisma.SdTicketWhereInput[] = []
    if (f.assigneeIds?.length) or.push({ assigneeId: { in: f.assigneeIds } })
    if (f.includeUnassigned) or.push({ assigneeId: null })
    and.push({ OR: or })
  }
  if (f.requesterId) where.requesterId = f.requesterId
  if (f.participantId) {
    and.push({ participants: { some: { userId: f.participantId } } })
  }
  if (f.customerId) where.customerId = f.customerId
  if (f.companyId) where.companyId = f.companyId
  if (f.contactId) where.contactId = f.contactId
  if (f.configItemId) where.configItemId = f.configItemId
  if (f.categoryId) where.categoryId = f.categoryId
  if (f.subcategoryId) where.subcategoryId = f.subcategoryId
  if (f.serviceId) where.serviceId = f.serviceId
  if (f.classificationId) where.classificationId = f.classificationId
  if (f.channel) where.channel = f.channel
  if (f.tags?.length) where.tags = { hasSome: f.tags }
  if (f.riskLevel) and.push({ riskPrediction: { level: f.riskLevel } })
  if (f.sla === 'breached') and.push(breachedWhere(now))
  if (f.sla === 'at_risk') {
    and.push({ slaAtRiskNotifiedAt: { not: null } })
    and.push(notBreachedWhere(now))
  }
  if (f.createdFrom || f.createdTo) {
    where.createdAt = {
      ...(f.createdFrom ? { gte: f.createdFrom } : {}),
      ...(f.createdTo ? { lte: f.createdTo } : {}),
    }
  }
  if (f.dueFrom || f.dueTo) {
    where.resolutionDueAt = {
      ...(f.dueFrom ? { gte: f.dueFrom } : {}),
      ...(f.dueTo ? { lte: f.dueTo } : {}),
    }
  }
  if (f.parentId !== undefined) where.parentId = f.parentId
  if (f.q) {
    const or: Prisma.SdTicketWhereInput[] = [
      { title: { contains: f.q, mode: 'insensitive' } },
      { description: { contains: f.q, mode: 'insensitive' } },
    ]
    if (f.qNumber !== undefined) or.push({ number: f.qNumber })
    and.push({ OR: or })
  }
  if (f.visibleToUserId) and.push(sdRequesterScope(f.visibleToUserId))

  if (and.length > 0) where.AND = and
  return where
}

export function sdTicketOrderBy(
  sort: SdTicketSort,
): Prisma.SdTicketOrderByWithRelationInput[] {
  const primary: Prisma.SdTicketOrderByWithRelationInput =
    sort.field === 'priority'
      ? { priority: { level: sort.order } }
      : sort.field === 'resolutionDueAt' || sort.field === 'firstResponseDueAt'
        ? { [sort.field]: { sort: sort.order, nulls: 'last' } }
        : { [sort.field]: sort.order }
  return [primary, { id: 'asc' }]
}

export interface SdTicketCreateData
  extends Omit<Prisma.SdTicketUncheckedCreateInput, 'number' | 'workspaceId'> {}

export const SdTicketRepository = {
  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<SdTicketWithRelations>> {
    try {
      const row = await prisma.sdTicket.findFirst({
        where: { id, workspaceId, deletedAt: null },
        include: SD_TICKET_INCLUDE,
      })
      if (!row) return err(sdTicketNotFound())
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk ticket', error))
    }
  },

  async findByNumber(
    number: number,
    workspaceId: string,
  ): Promise<Result<SdTicketWithRelations>> {
    try {
      const row = await prisma.sdTicket.findFirst({
        where: { number, workspaceId, deletedAt: null },
        include: SD_TICKET_INCLUDE,
      })
      if (!row) return err(sdTicketNotFound())
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk ticket by number', error))
    }
  },

  /** Sem escopo de workspace — só para fluxos de sistema (worker/automação). */
  async findByIdUnscoped(id: string): Promise<Result<SdTicketWithRelations>> {
    try {
      const row = await prisma.sdTicket.findFirst({
        where: { id, deletedAt: null },
        include: SD_TICKET_INCLUDE,
      })
      if (!row) return err(sdTicketNotFound())
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk ticket', error))
    }
  },

  async list(params: {
    where: Prisma.SdTicketWhereInput
    sort: SdTicketSort
    page: number
    pageSize: number
    cursor?: string
  }): Promise<
    Result<{
      items: SdTicketWithRelations[]
      total: number
      nextCursor: string | null
    }>
  > {
    try {
      const [rows, total] = await Promise.all([
        prisma.sdTicket.findMany({
          where: params.where,
          include: SD_TICKET_INCLUDE,
          orderBy: sdTicketOrderBy(params.sort),
          take: params.pageSize + 1,
          ...(params.cursor
            ? { cursor: { id: params.cursor }, skip: 1 }
            : { skip: (params.page - 1) * params.pageSize }),
        }),
        prisma.sdTicket.count({ where: params.where }),
      ])
      const hasMore = rows.length > params.pageSize
      const items = hasMore ? rows.slice(0, params.pageSize) : rows
      return ok({
        items,
        total,
        nextCursor: hasMore ? items[items.length - 1].id : null,
      })
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk tickets', error))
    }
  },

  /** Kanban: contagem por fase + primeiros `take` de cada fase. */
  async kanban(params: {
    where: Prisma.SdTicketWhereInput
    phaseIds: string[]
    sort: SdTicketSort
    take: number
  }): Promise<
    Result<{ phaseId: string; count: number; items: SdTicketWithRelations[] }[]>
  > {
    try {
      const columns = await Promise.all(
        params.phaseIds.map(async (phaseId) => {
          const where = { AND: [params.where, { phaseId }] }
          const [items, count] = await Promise.all([
            prisma.sdTicket.findMany({
              where,
              include: SD_TICKET_INCLUDE,
              orderBy: sdTicketOrderBy(params.sort),
              take: params.take,
            }),
            prisma.sdTicket.count({ where }),
          ])
          return { phaseId, count, items }
        }),
      )
      return ok(columns)
    } catch (error) {
      return err(dbError('Failed to build ServiceDesk kanban', error))
    }
  },

  async count(where: Prisma.SdTicketWhereInput): Promise<Result<number>> {
    try {
      return ok(await prisma.sdTicket.count({ where }))
    } catch (error) {
      return err(dbError('Failed to count ServiceDesk tickets', error))
    }
  },

  /** Contagens do painel inicial. */
  async summary(params: {
    workspaceId: string
    actorId: string
    scope?: Prisma.SdTicketWhereInput
    todayStart: Date
    now: Date
  }): Promise<
    Result<{
      byPhaseCategory: Record<SdPhaseCategory, number>
      myOpen: number
      unassigned: number
      atRisk: number
      breached: number
      createdToday: number
    }>
  > {
    const base: Prisma.SdTicketWhereInput = {
      workspaceId: params.workspaceId,
      deletedAt: null,
      ...(params.scope ? { AND: [params.scope] } : {}),
    }
    const open: Prisma.SdTicketWhereInput = {
      ...base,
      phase: { category: { notIn: CLOSED_CATEGORIES } },
    }
    const categories: SdPhaseCategory[] = [
      'NEW',
      'IN_PROGRESS',
      'WAITING',
      'RESOLVED',
      'CLOSED',
      'CANCELED',
    ]
    try {
      const [perCategory, myOpen, unassigned, atRisk, breached, createdToday] =
        await Promise.all([
          Promise.all(
            categories.map((category) =>
              prisma.sdTicket.count({
                where: { ...base, phase: { category } },
              }),
            ),
          ),
          prisma.sdTicket.count({
            where: { ...open, assigneeId: params.actorId },
          }),
          prisma.sdTicket.count({ where: { ...open, assigneeId: null } }),
          prisma.sdTicket.count({
            where: {
              AND: [
                open,
                { slaAtRiskNotifiedAt: { not: null } },
                notBreachedWhere(params.now),
              ],
            },
          }),
          prisma.sdTicket.count({
            where: { AND: [open, breachedWhere(params.now)] },
          }),
          prisma.sdTicket.count({
            where: { ...base, createdAt: { gte: params.todayStart } },
          }),
        ])
      const byPhaseCategory = Object.fromEntries(
        categories.map((c, i) => [c, perCategory[i]]),
      ) as Record<SdPhaseCategory, number>
      return ok({
        byPhaseCategory,
        myOpen,
        unassigned,
        atRisk,
        breached,
        createdToday,
      })
    } catch (error) {
      return err(dbError('Failed to summarize ServiceDesk tickets', error))
    }
  },

  /**
   * Cria o chamado com o próximo número do workspace, reservado atomicamente
   * (`UPDATE sd_settings ... RETURNING`) na mesma transação. A linha de
   * `sd_settings` precisa existir (ver `SdTicketContextRepository.ensureSettings`).
   */
  async createWithNumber(
    workspaceId: string,
    data: SdTicketCreateData,
  ): Promise<Result<SdTicketWithRelations>> {
    try {
      const row = await prisma.$transaction(async (tx) => {
        const reserved = await tx.$queryRaw<{ number: number }[]>`
          UPDATE sd_settings
             SET next_ticket_number = next_ticket_number + 1,
                 updated_at = now()
           WHERE workspace_id = ${workspaceId}
       RETURNING next_ticket_number - 1 AS number`
        if (reserved.length === 0) {
          throw new Error('sd_settings row missing for workspace')
        }
        return tx.sdTicket.create({
          data: { ...data, workspaceId, number: Number(reserved[0].number) },
          include: SD_TICKET_INCLUDE,
        })
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to create ServiceDesk ticket', error))
    }
  },

  async update(
    id: string,
    data: Prisma.SdTicketUncheckedUpdateInput,
  ): Promise<Result<SdTicketWithRelations>> {
    try {
      const row = await prisma.sdTicket.update({
        where: { id },
        data,
        include: SD_TICKET_INCLUDE,
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to update ServiceDesk ticket', error))
    }
  },

  /** Carimba `firstRespondedAt` só se ainda vazio. `true` se carimbou. */
  async markFirstResponse(id: string, at: Date): Promise<Result<boolean>> {
    try {
      const result = await prisma.sdTicket.updateMany({
        where: { id, firstRespondedAt: null },
        data: { firstRespondedAt: at, lastActivityAt: at },
      })
      return ok(result.count > 0)
    } catch (error) {
      return err(dbError('Failed to mark ServiceDesk first response', error))
    }
  },

  async touchActivity(id: string, at: Date): Promise<Result<void>> {
    try {
      await prisma.sdTicket.update({
        where: { id },
        data: { lastActivityAt: at },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to touch ServiceDesk ticket', error))
    }
  },

  async softDelete(id: string): Promise<Result<void>> {
    try {
      await prisma.sdTicket.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete ServiceDesk ticket', error))
    }
  },

  /** `true` se `candidateParentId` é o próprio chamado ou um descendente. */
  async isDescendantOrSelf(
    ticketId: string,
    candidateParentId: string,
  ): Promise<Result<boolean>> {
    try {
      let current: string | null = candidateParentId
      for (let depth = 0; current && depth < 50; depth++) {
        if (current === ticketId) return ok(true)
        const row: { parentId: string | null } | null =
          await prisma.sdTicket.findUnique({
            where: { id: current },
            select: { parentId: true },
          })
        current = row?.parentId ?? null
      }
      return ok(false)
    } catch (error) {
      return err(dbError('Failed to walk ServiceDesk ticket tree', error))
    }
  },

  /**
   * Reserva uma marcação única (idempotência do worker): só grava se ainda
   * não estava marcada. Devolve `true` se esta chamada marcou.
   */
  async claimSlaFlag(
    id: string,
    flag: 'firstResponseBreached' | 'resolutionBreached' | 'slaAtRisk',
    now: Date,
  ): Promise<Result<boolean>> {
    try {
      const result =
        flag === 'slaAtRisk'
          ? await prisma.sdTicket.updateMany({
              where: { id, slaAtRiskNotifiedAt: null },
              data: { slaAtRiskNotifiedAt: now },
            })
          : await prisma.sdTicket.updateMany({
              where: { id, [flag]: false },
              data: { [flag]: true },
            })
      return ok(result.count > 0)
    } catch (error) {
      return err(dbError('Failed to claim ServiceDesk SLA flag', error))
    }
  },

  /** Abertos (fase não final) com prazo de SLA, em lotes por id. */
  async listOpenForSla(
    workspaceId: string,
    afterId: string | null,
    take: number,
  ): Promise<Result<SdTicketWithRelations[]>> {
    try {
      const rows = await prisma.sdTicket.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          phase: { category: { notIn: CLOSED_CATEGORIES } },
          ...(afterId ? { id: { gt: afterId } } : {}),
        },
        include: SD_TICKET_INCLUDE,
        orderBy: { id: 'asc' },
        take,
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list open ServiceDesk tickets', error))
    }
  },

  /**
   * RESOLVED há mais de `resolvedBefore` (fechamento automático). Com
   * `signedOnly`, só os que já têm assinatura (fechar exige assinatura).
   */
  async listResolvedBefore(
    workspaceId: string,
    resolvedBefore: Date,
    take: number,
    signedOnly = false,
  ): Promise<Result<SdTicketWithRelations[]>> {
    try {
      const rows = await prisma.sdTicket.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          phase: { category: 'RESOLVED' },
          resolvedAt: { lte: resolvedBefore },
          ...(signedOnly ? { signatures: { some: {} } } : {}),
        },
        include: SD_TICKET_INCLUDE,
        orderBy: { resolvedAt: 'asc' },
        take,
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list resolved ServiceDesk tickets', error))
    }
  },
}
