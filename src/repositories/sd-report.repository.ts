import type {
  Prisma,
  SdReportFormat,
  SdReportPeriod,
  SdReportRunStatus,
  SdTicketType,
} from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { Result } from '@/src/lib/result'
import { sdDb, sdDbFind } from './sd-config-db'

/**
 * Relatórios agendados (`SdScheduledReport`), suas execuções
 * (`SdReportRun`) e a leitura dos chamados que a apuração consome.
 *
 * A idempotência do agendamento é `(reportId, periodStart)`: `findByPeriod`
 * é consultado antes de gerar. O índice do schema não é `@@unique` (e a
 * fundação da leva 3 é intocável), então a trava é a consulta — basta,
 * porque só o tick horário enfileira o job e a fila entrega um job por
 * agendamento por vez.
 */

const relations = {
  _count: { select: { runs: true } },
} satisfies Prisma.SdScheduledReportInclude

export type SdScheduledReportWithCount = Prisma.SdScheduledReportGetPayload<{
  include: typeof relations
}>

const runRelations = {
  report: { select: { id: true, name: true } },
  requestedBy: { select: { id: true, name: true } },
} satisfies Prisma.SdReportRunInclude

export type SdReportRunWithRelations = Prisma.SdReportRunGetPayload<{
  include: typeof runRelations
}>

export interface SdScheduledReportData {
  name?: string
  customerIds?: string[]
  departmentIds?: string[]
  ticketTypes?: SdTicketType[]
  period?: SdReportPeriod
  formats?: SdReportFormat[]
  dayOfMonth?: number
  atTime?: string
  timezone?: string
  recipients?: string[]
  includeAccountOwners?: boolean
  active?: boolean
  lastRunAt?: Date | null
  nextRunAt?: Date | null
}

/** Recorte da apuração: vazio = todos. */
export interface SdReportScopeFilter {
  customerIds: string[]
  departmentIds: string[]
  ticketTypes: SdTicketType[]
}

const TICKET_SELECT = {
  id: true,
  number: true,
  type: true,
  title: true,
  createdAt: true,
  firstResponseDueAt: true,
  resolutionDueAt: true,
  firstRespondedAt: true,
  resolvedAt: true,
  closedAt: true,
  csatScore: true,
  customerId: true,
  customer: { select: { name: true } },
  departmentId: true,
  department: { select: { name: true } },
  priorityId: true,
  priority: { select: { name: true } },
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
} satisfies Prisma.SdTicketSelect

export type SdReportTicketRecord = Prisma.SdTicketGetPayload<{
  select: typeof TICKET_SELECT
}>

/** Calendário de expediente padrão do workspace (o fallback da apuração). */
export type SdReportCalendarRow = {
  timezone: string
  schedule: Prisma.JsonValue
  holidays: Prisma.JsonValue
  is24x7: boolean
} | null

export interface SdReportCustomerContact {
  id: string
  name: string
  email: string | null
  /** Quem mantém o cadastro — o "responsável pela conta" de hoje. */
  ownerEmail: string | null
  ownerName: string | null
}

export const SdScheduledReportRepository = {
  async list(
    workspaceId: string,
    options: { includeInactive?: boolean } = {},
  ): Promise<Result<SdScheduledReportWithCount[]>> {
    return sdDb('Failed to list ServiceDesk scheduled reports', () =>
      prisma.sdScheduledReport.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          ...(options.includeInactive ? {} : { active: true }),
        },
        include: relations,
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
      }),
    )
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<SdScheduledReportWithCount>> {
    return sdDbFind('Failed to find ServiceDesk scheduled report', () =>
      prisma.sdScheduledReport.findFirst({
        where: { id, workspaceId, deletedAt: null },
        include: relations,
      }),
    )
  },

  async create(
    workspaceId: string,
    data: SdScheduledReportData & { name: string; createdById: string },
  ): Promise<Result<SdScheduledReportWithCount>> {
    return sdDb('Failed to create ServiceDesk scheduled report', () =>
      prisma.sdScheduledReport.create({
        data: { ...data, workspaceId },
        include: relations,
      }),
    )
  },

  async update(
    id: string,
    workspaceId: string,
    data: SdScheduledReportData,
  ): Promise<Result<SdScheduledReportWithCount>> {
    return sdDb('Failed to update ServiceDesk scheduled report', () =>
      prisma.sdScheduledReport.update({
        where: { id, workspaceId },
        data,
        include: relations,
      }),
    )
  },

  /** Exclusão lógica: para de enviar e sai das listas; o histórico fica. */
  async softDelete(id: string, workspaceId: string): Promise<Result<void>> {
    return sdDb('Failed to delete ServiceDesk scheduled report', async () => {
      await prisma.sdScheduledReport.update({
        where: { id, workspaceId },
        data: { deletedAt: new Date(), active: false, nextRunAt: null },
      })
    })
  },

  /** Agendamentos vencidos (todas as workspaces) — tick do worker. */
  async listDue(
    now: Date,
    limit: number,
  ): Promise<Result<SdScheduledReportWithCount[]>> {
    return sdDb('Failed to list due ServiceDesk scheduled reports', () =>
      prisma.sdScheduledReport.findMany({
        where: {
          active: true,
          deletedAt: null,
          nextRunAt: { not: null, lte: now },
        },
        include: relations,
        orderBy: { nextRunAt: 'asc' },
        take: limit,
      }),
    )
  },
}

export const SdReportRunRepository = {
  async list(
    workspaceId: string,
    options: { reportId?: string; limit: number },
  ): Promise<Result<SdReportRunWithRelations[]>> {
    return sdDb('Failed to list ServiceDesk report runs', () =>
      prisma.sdReportRun.findMany({
        where: {
          workspaceId,
          ...(options.reportId ? { reportId: options.reportId } : {}),
        },
        include: runRelations,
        orderBy: { createdAt: 'desc' },
        take: options.limit,
      }),
    )
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<SdReportRunWithRelations>> {
    return sdDbFind('Failed to find ServiceDesk report run', () =>
      prisma.sdReportRun.findFirst({
        where: { id, workspaceId },
        include: runRelations,
      }),
    )
  },

  /** Trava de idempotência: a execução daquele período já existe? */
  async findByPeriod(
    reportId: string,
    periodStart: Date,
  ): Promise<Result<SdReportRunWithRelations | null>> {
    return sdDb('Failed to find a ServiceDesk report run by period', () =>
      prisma.sdReportRun.findFirst({
        where: { reportId, periodStart },
        include: runRelations,
      }),
    )
  },

  async create(data: {
    workspaceId: string
    reportId?: string | null
    status: SdReportRunStatus
    periodStart: Date
    periodEnd: Date
    summary?: Prisma.InputJsonValue
    pdfKey?: string | null
    csvKey?: string | null
    recipients?: string[]
    sentAt?: Date | null
    error?: string | null
    requestedById?: string | null
  }): Promise<Result<SdReportRunWithRelations>> {
    return sdDb('Failed to create a ServiceDesk report run', () =>
      prisma.sdReportRun.create({ data, include: runRelations }),
    )
  },

  async update(
    id: string,
    data: {
      status?: SdReportRunStatus
      pdfKey?: string | null
      csvKey?: string | null
      recipients?: string[]
      sentAt?: Date | null
      error?: string | null
    },
  ): Promise<Result<SdReportRunWithRelations>> {
    return sdDb('Failed to update a ServiceDesk report run', () =>
      prisma.sdReportRun.update({ where: { id }, data, include: runRelations }),
    )
  },
}

export const SdReportDataRepository = {
  /**
   * Chamados que tocam o período: abertos, resolvidos, fechados ou ainda em
   * aberto dentro dele. O recorte (cliente, departamento, tipo) e o
   * calendário do chamado vêm prontos; a conta é feita na lib pura.
   */
  async collectTickets(
    workspaceId: string,
    scope: SdReportScopeFilter,
    periodStart: Date,
    periodEnd: Date,
    limit: number,
  ): Promise<Result<SdReportTicketRecord[]>> {
    return sdDb('Failed to collect ServiceDesk report tickets', () =>
      prisma.sdTicket.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          ...(scope.customerIds.length > 0
            ? { customerId: { in: scope.customerIds } }
            : {}),
          ...(scope.departmentIds.length > 0
            ? { departmentId: { in: scope.departmentIds } }
            : {}),
          ...(scope.ticketTypes.length > 0
            ? { type: { in: scope.ticketTypes } }
            : {}),
          createdAt: { lt: periodEnd },
          OR: [
            { createdAt: { gte: periodStart } },
            { resolvedAt: { gte: periodStart } },
            { closedAt: { gte: periodStart } },
            { resolvedAt: null, closedAt: null },
          ],
        },
        select: TICKET_SELECT,
        orderBy: { number: 'asc' },
        take: limit,
      }),
    )
  },

  /** Calendário padrão do workspace (fallback do chamado sem política). */
  async findDefaultCalendar(
    workspaceId: string,
  ): Promise<Result<SdReportCalendarRow>> {
    return sdDb('Failed to find the ServiceDesk default calendar', () =>
      prisma.sdBusinessCalendar.findFirst({
        where: { workspaceId, isDefault: true },
        select: {
          timezone: true,
          schedule: true,
          holidays: true,
          is24x7: true,
        },
      }),
    )
  },

  /** Nome e slug do workspace + prefixos (`SdSettings.ticketPrefixes`). */
  async findContext(workspaceId: string): Promise<
    Result<{
      workspaceName: string
      workspaceSlug: string
      ticketPrefixes: Prisma.JsonValue
    } | null>
  > {
    return sdDb('Failed to load the ServiceDesk report context', async () => {
      const [workspace, settings] = await Promise.all([
        prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { name: true, slug: true },
        }),
        prisma.sdSettings.findUnique({
          where: { workspaceId },
          select: { ticketPrefixes: true },
        }),
      ])
      if (!workspace) return null
      return {
        workspaceName: workspace.name,
        workspaceSlug: workspace.slug,
        ticketPrefixes: settings?.ticketPrefixes ?? null,
      }
    })
  },

  /** Clientes do recorte com o e-mail da conta e de quem a mantém. */
  async findCustomerContacts(
    workspaceId: string,
    customerIds: string[],
  ): Promise<Result<SdReportCustomerContact[]>> {
    return sdDb(
      'Failed to load the ServiceDesk report account owners',
      async () => {
        if (customerIds.length === 0) return []
        const rows = await prisma.sdCustomer.findMany({
          where: { id: { in: customerIds }, workspaceId, deletedAt: null },
          select: {
            id: true,
            name: true,
            email: true,
            createdBy: { select: { email: true, name: true } },
          },
        })
        return rows.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          // `createdById` é obrigatório: o cadastro sempre tem um mantenedor.
          ownerEmail: row.createdBy.email,
          ownerName: row.createdBy.name,
        }))
      },
    )
  },

  /** Nome dos clientes e departamentos do recorte (rótulos da tela). */
  async findScopeLabels(
    workspaceId: string,
    scope: { customerIds: string[]; departmentIds: string[] },
  ): Promise<
    Result<{
      customers: { id: string; name: string }[]
      departments: { id: string; name: string }[]
    }>
  > {
    return sdDb(
      'Failed to load the ServiceDesk report scope labels',
      async () => {
        const [customers, departments] = await Promise.all([
          scope.customerIds.length > 0
            ? prisma.sdCustomer.findMany({
                where: { id: { in: scope.customerIds }, workspaceId },
                select: { id: true, name: true },
                orderBy: { name: 'asc' },
              })
            : Promise.resolve([]),
          scope.departmentIds.length > 0
            ? prisma.sdDepartment.findMany({
                where: { id: { in: scope.departmentIds }, workspaceId },
                select: { id: true, name: true },
                orderBy: { name: 'asc' },
              })
            : Promise.resolve([]),
        ])
        return { customers, departments }
      },
    )
  },
}
