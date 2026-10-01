import type { Prisma, SdRateWindow, SdTicketType } from '@prisma/client'
import { sdContractNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import type { ListSdContractsDTO } from '@/src/schemas/sd-contract.schema'
import { dbError } from './db-error'
import { SD_USER_SUMMARY_SELECT } from './sd-ticket.repository'

export const SD_CONTRACT_INCLUDE = {
  customer: { select: { id: true, name: true, tradeName: true } },
  slaPolicy: { select: { id: true, name: true } },
  createdBy: { select: SD_USER_SUMMARY_SELECT },
  rates: {
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    include: { priority: { select: { id: true, name: true } } },
  },
  /** O período aberto mais recente — o "corrente" na tela. */
  periods: {
    where: { status: 'OPEN' },
    orderBy: { periodStart: 'desc' },
    take: 1,
    include: { closedBy: { select: SD_USER_SUMMARY_SELECT } },
  },
} as const satisfies Prisma.SdContractInclude

export type SdContractWithRelations = Prisma.SdContractGetPayload<{
  include: typeof SD_CONTRACT_INCLUDE
}>

export interface SdContractRateData {
  ticketType: SdTicketType | null
  priorityId: string | null
  window: SdRateWindow
  /** Decimal como string (`"180.00"`). */
  hourlyRate: string
  multiplier: string
}

export type SdContractData = Omit<
  Prisma.SdContractUncheckedCreateInput,
  'id' | 'workspaceId' | 'createdById' | 'rates' | 'periods' | 'timeEntries'
>

/** Contrato de atendimento, a tabela de valores e as linhas de contexto. */
export const SdContractRepository = {
  async list(
    workspaceId: string,
    filters: ListSdContractsDTO = {},
  ): Promise<Result<SdContractWithRelations[]>> {
    try {
      const rows = await prisma.sdContract.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          ...(filters.customerId ? { customerId: filters.customerId } : {}),
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.q
            ? {
                OR: [
                  { name: { contains: filters.q, mode: 'insensitive' } },
                  { code: { contains: filters.q, mode: 'insensitive' } },
                  {
                    customer: {
                      name: { contains: filters.q, mode: 'insensitive' },
                    },
                  },
                ],
              }
            : {}),
        },
        orderBy: [{ status: 'asc' }, { startsAt: 'desc' }],
        take: 200,
        include: SD_CONTRACT_INCLUDE,
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk contracts', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<SdContractWithRelations>> {
    try {
      const row = await prisma.sdContract.findFirst({
        where: { id, workspaceId, deletedAt: null },
        include: SD_CONTRACT_INCLUDE,
      })
      if (!row) return err(sdContractNotFound())
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk contract', error))
    }
  },

  /** Sem escopo de workspace — só para o worker de faturamento. */
  async findByIdUnscoped(
    id: string,
  ): Promise<Result<SdContractWithRelations | null>> {
    try {
      const row = await prisma.sdContract.findFirst({
        where: { id, deletedAt: null },
        include: SD_CONTRACT_INCLUDE,
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk contract', error))
    }
  },

  /**
   * Contrato vigente do cliente que cobre o tipo do chamado (o mais recente,
   * quando houver mais de um). Usado para carimbar `SdTicket.contractId`.
   */
  async findActiveForCustomer(
    workspaceId: string,
    customerId: string,
    type: SdTicketType,
    at: Date,
  ): Promise<Result<{ id: string } | null>> {
    try {
      const row = await prisma.sdContract.findFirst({
        where: {
          workspaceId,
          customerId,
          deletedAt: null,
          status: 'ACTIVE',
          startsAt: { lte: at },
          OR: [{ endsAt: null }, { endsAt: { gt: at } }],
          AND: [
            {
              OR: [
                { ticketTypes: { isEmpty: true } },
                { ticketTypes: { has: type } },
              ],
            },
          ],
        },
        orderBy: { startsAt: 'desc' },
        select: { id: true },
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to resolve ServiceDesk contract', error))
    }
  },

  /**
   * Outro contrato **ativo** do mesmo cliente cuja vigência cruza a janela
   * informada (`endsAt` nulo = sem fim). Vazio = pode salvar.
   */
  async findOverlapping(params: {
    workspaceId: string
    customerId: string
    startsAt: Date
    endsAt: Date | null
    excludeId?: string
  }): Promise<Result<{ id: string; name: string } | null>> {
    try {
      const row = await prisma.sdContract.findFirst({
        where: {
          workspaceId: params.workspaceId,
          customerId: params.customerId,
          deletedAt: null,
          status: 'ACTIVE',
          ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
          ...(params.endsAt ? { startsAt: { lt: params.endsAt } } : {}),
          OR: [{ endsAt: null }, { endsAt: { gt: params.startsAt } }],
        },
        select: { id: true, name: true },
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to check ServiceDesk contract overlap', error))
    }
  },

  async create(
    workspaceId: string,
    createdById: string,
    data: SdContractData,
    rates: SdContractRateData[],
  ): Promise<Result<SdContractWithRelations>> {
    try {
      const row = await prisma.sdContract.create({
        data: {
          ...data,
          workspaceId,
          createdById,
          rates: {
            create: rates.map((rate, position) => ({ ...rate, position })),
          },
        },
        include: SD_CONTRACT_INCLUDE,
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to create ServiceDesk contract', error))
    }
  },

  /** `rates` informado substitui a tabela de valores inteira. */
  async update(
    id: string,
    data: Partial<SdContractData>,
    rates?: SdContractRateData[],
  ): Promise<Result<SdContractWithRelations>> {
    try {
      const row = await prisma.$transaction(async (tx) => {
        if (rates) {
          await tx.sdContractRate.deleteMany({ where: { contractId: id } })
        }
        return tx.sdContract.update({
          where: { id },
          data: {
            ...data,
            ...(rates
              ? {
                  rates: {
                    create: rates.map((rate, position) => ({
                      ...rate,
                      position,
                    })),
                  },
                }
              : {}),
          },
          include: SD_CONTRACT_INCLUDE,
        })
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to update ServiceDesk contract', error))
    }
  },

  async softDelete(id: string): Promise<Result<void>> {
    try {
      await prisma.sdContract.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'ENDED' },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete ServiceDesk contract', error))
    }
  },

  /** Todos os contratos ativos (qualquer workspace) — tick de faturamento. */
  async listActiveForBilling(): Promise<Result<SdContractWithRelations[]>> {
    try {
      const rows = await prisma.sdContract.findMany({
        where: { deletedAt: null, status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
        include: SD_CONTRACT_INCLUDE,
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk contracts', error))
    }
  },
}
