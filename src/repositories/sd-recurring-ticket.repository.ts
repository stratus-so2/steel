import type {
  Prisma,
  SdRecurrenceFrequency,
  SdRecurringRunStatus,
  SdTicketType,
} from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'
import { sdDb, sdDbFind } from './sd-config-db'

/**
 * Chamados recorrentes (`SdRecurringTicket`) e suas ocorrências
 * (`SdRecurringTicketRun`). A unicidade `(recurringId, scheduledFor)` é a
 * trava de idempotência do tick: `claimRun` devolve `null` quando a
 * ocorrência já foi registrada, em vez de erro.
 */

const relations = {
  template: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true } },
  configItem: { select: { id: true, name: true, code: true } },
  _count: { select: { runs: true } },
} satisfies Prisma.SdRecurringTicketInclude

export type SdRecurringTicketWithRelations =
  Prisma.SdRecurringTicketGetPayload<{
    include: typeof relations
  }>

const runRelations = {
  ticket: { select: { id: true, number: true, type: true, title: true } },
} satisfies Prisma.SdRecurringTicketRunInclude

export type SdRecurringTicketRunWithTicket =
  Prisma.SdRecurringTicketRunGetPayload<{ include: typeof runRelations }>

/** Ocorrência mais recente que abriu chamado (checagem de `skipIfOpen`). */
export type SdRecurringTicketRunWithPhase =
  Prisma.SdRecurringTicketRunGetPayload<{
    include: {
      ticket: {
        select: {
          id: true
          number: true
          type: true
          deletedAt: true
          phase: { select: { category: true } }
        }
      }
    }
  }>

export interface SdRecurringTicketData {
  name?: string
  description?: string | null
  active?: boolean
  templateId?: string | null
  defaults?: Prisma.InputJsonValue
  customerId?: string | null
  configItemId?: string | null
  departmentId?: string | null
  assigneeId?: string | null
  frequency?: SdRecurrenceFrequency
  interval?: number
  byWeekday?: number[]
  byMonthday?: number | null
  atTime?: string
  timezone?: string
  startsAt?: Date
  endsAt?: Date | null
  leadTimeMinutes?: number
  skipIfOpen?: boolean
  lastRunAt?: Date | null
  nextRunAt?: Date | null
}

export interface SdRecurringTicketListOptions {
  ticketType?: SdTicketType
  configItemId?: string
  customerId?: string
  includeInactive?: boolean
}

export const SdRecurringTicketRepository = {
  async list(
    workspaceId: string,
    options: SdRecurringTicketListOptions = {},
  ): Promise<Result<SdRecurringTicketWithRelations[]>> {
    return sdDb('Failed to list ServiceDesk recurring tickets', () =>
      prisma.sdRecurringTicket.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          ...(options.ticketType ? { ticketType: options.ticketType } : {}),
          ...(options.configItemId
            ? { configItemId: options.configItemId }
            : {}),
          ...(options.customerId ? { customerId: options.customerId } : {}),
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
  ): Promise<Result<SdRecurringTicketWithRelations>> {
    return sdDbFind('Failed to find ServiceDesk recurring ticket', () =>
      prisma.sdRecurringTicket.findFirst({
        where: { id, workspaceId, deletedAt: null },
        include: relations,
      }),
    )
  },

  async create(
    workspaceId: string,
    data: SdRecurringTicketData & {
      ticketType: SdTicketType
      name: string
      startsAt: Date
      createdById: string
    },
  ): Promise<Result<SdRecurringTicketWithRelations>> {
    return sdDb('Failed to create ServiceDesk recurring ticket', () =>
      prisma.sdRecurringTicket.create({
        data: { ...data, workspaceId },
        include: relations,
      }),
    )
  },

  async update(
    id: string,
    workspaceId: string,
    data: SdRecurringTicketData,
  ): Promise<Result<SdRecurringTicketWithRelations>> {
    return sdDb('Failed to update ServiceDesk recurring ticket', () =>
      prisma.sdRecurringTicket.update({
        where: { id, workspaceId },
        data,
        include: relations,
      }),
    )
  },

  /** Exclusão lógica: a rotina para de disparar e sai das listas. */
  async softDelete(id: string, workspaceId: string): Promise<Result<void>> {
    return sdDb('Failed to delete ServiceDesk recurring ticket', async () => {
      await prisma.sdRecurringTicket.update({
        where: { id, workspaceId },
        data: { deletedAt: new Date(), active: false, nextRunAt: null },
      })
    })
  },

  /**
   * Regras vencidas (todas as workspaces): ativas, não excluídas e com
   * `nextRunAt` no passado. Usado pelo tick do worker.
   */
  async listDue(
    now: Date,
    limit: number,
  ): Promise<Result<SdRecurringTicketWithRelations[]>> {
    return sdDb('Failed to list due ServiceDesk recurring tickets', () =>
      prisma.sdRecurringTicket.findMany({
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

  /**
   * Quais dos ids referenciados **não** existem nesta workspace (cliente e
   * item de configuração, que não estão em `assertSdRefs`).
   */
  async findMissingRefs(
    workspaceId: string,
    refs: { customerId?: string | null; configItemId?: string | null },
  ): Promise<Result<('customer' | 'configItem')[]>> {
    return sdDb(
      'Failed to check ServiceDesk recurring ticket refs',
      async () => {
        const missing: ('customer' | 'configItem')[] = []
        if (refs.customerId) {
          const customer = await prisma.sdCustomer.findFirst({
            where: { id: refs.customerId, workspaceId, deletedAt: null },
            select: { id: true },
          })
          if (!customer) missing.push('customer')
        }
        if (refs.configItemId) {
          const configItem = await prisma.sdConfigItem.findFirst({
            where: { id: refs.configItemId, workspaceId, deletedAt: null },
            select: { id: true },
          })
          if (!configItem) missing.push('configItem')
        }
        return missing
      },
    )
  },
}

export const SdRecurringTicketRunRepository = {
  async listByRecurring(
    recurringId: string,
    workspaceId: string,
    limit: number,
  ): Promise<Result<SdRecurringTicketRunWithTicket[]>> {
    return sdDb('Failed to list ServiceDesk recurring ticket runs', () =>
      prisma.sdRecurringTicketRun.findMany({
        where: { recurringId, workspaceId },
        include: runRelations,
        orderBy: { scheduledFor: 'desc' },
        take: limit,
      }),
    )
  },

  /**
   * Reserva a ocorrência `(recurringId, scheduledFor)`. `null` quando ela já
   * existe — reprocessar o tick não duplica chamado.
   */
  async claim(data: {
    workspaceId: string
    recurringId: string
    scheduledFor: Date
  }): Promise<Result<SdRecurringTicketRunWithTicket | null>> {
    try {
      const run = await prisma.sdRecurringTicketRun.create({
        data,
        include: runRelations,
      })
      return ok(run)
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        return ok(null)
      }
      return err(dbError('Failed to claim a ServiceDesk recurring run', error))
    }
  },

  async finish(
    id: string,
    data: {
      status: SdRecurringRunStatus
      ticketId?: string | null
      reason?: string | null
    },
  ): Promise<Result<SdRecurringTicketRunWithTicket>> {
    return sdDb('Failed to finish a ServiceDesk recurring ticket run', () =>
      prisma.sdRecurringTicketRun.update({
        where: { id },
        data,
        include: runRelations,
      }),
    )
  },

  /** Última ocorrência que abriu chamado, com a fase atual dele. */
  async findLatestWithTicket(
    recurringId: string,
  ): Promise<Result<SdRecurringTicketRunWithPhase | null>> {
    return sdDb('Failed to find the latest ServiceDesk recurring run', () =>
      prisma.sdRecurringTicketRun.findFirst({
        where: { recurringId, ticketId: { not: null } },
        include: {
          ticket: {
            select: {
              id: true,
              number: true,
              type: true,
              deletedAt: true,
              phase: { select: { category: true } },
            },
          },
        },
        orderBy: { scheduledFor: 'desc' },
      }),
    )
  },
}
