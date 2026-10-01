import type { Prisma } from '@prisma/client'
import { sdContractPeriodNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'
import { SD_USER_SUMMARY_SELECT } from './sd-ticket.repository'

export const SD_CONTRACT_PERIOD_INCLUDE = {
  closedBy: { select: SD_USER_SUMMARY_SELECT },
} as const satisfies Prisma.SdContractPeriodInclude

export type SdContractPeriodWithRelations = Prisma.SdContractPeriodGetPayload<{
  include: typeof SD_CONTRACT_PERIOD_INCLUDE
}>

export interface SdContractPeriodTotalsData {
  includedMinutes?: number
  usedMinutes?: number
  billableMinutes?: number
  overageMinutes?: number
  carriedMinutes?: number
  /** Decimal como string. */
  amount?: string
  status?: 'OPEN' | 'CLOSED'
  closedAt?: Date | null
  closedById?: string | null
}

/** Períodos de faturamento do contrato. Sem regra de negócio. */
export const SdContractPeriodRepository = {
  async listByContract(
    contractId: string,
  ): Promise<Result<SdContractPeriodWithRelations[]>> {
    try {
      const rows = await prisma.sdContractPeriod.findMany({
        where: { contractId },
        orderBy: { periodStart: 'desc' },
        take: 60,
        include: SD_CONTRACT_PERIOD_INCLUDE,
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk contract periods', error))
    }
  },

  async findById(
    id: string,
    contractId: string,
  ): Promise<Result<SdContractPeriodWithRelations>> {
    try {
      const row = await prisma.sdContractPeriod.findFirst({
        where: { id, contractId },
        include: SD_CONTRACT_PERIOD_INCLUDE,
      })
      if (!row) return err(sdContractPeriodNotFound())
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk contract period', error))
    }
  },

  /** Único por `(contractId, periodStart)` — a chave da idempotência. */
  async findByStart(
    contractId: string,
    periodStart: Date,
  ): Promise<Result<SdContractPeriodWithRelations | null>> {
    try {
      const row = await prisma.sdContractPeriod.findUnique({
        where: { contractId_periodStart: { contractId, periodStart } },
        include: SD_CONTRACT_PERIOD_INCLUDE,
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk contract period', error))
    }
  },

  /** Período imediatamente anterior a `before` (para o saldo acumulado). */
  async findPrevious(
    contractId: string,
    before: Date,
  ): Promise<Result<SdContractPeriodWithRelations | null>> {
    try {
      const row = await prisma.sdContractPeriod.findFirst({
        where: { contractId, periodStart: { lt: before } },
        orderBy: { periodStart: 'desc' },
        include: SD_CONTRACT_PERIOD_INCLUDE,
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk contract period', error))
    }
  },

  /** Períodos abertos já vencidos de um contrato (o tick os fecha). */
  async listOverdueOpen(
    contractId: string,
    now: Date,
  ): Promise<Result<SdContractPeriodWithRelations[]>> {
    try {
      const rows = await prisma.sdContractPeriod.findMany({
        where: { contractId, status: 'OPEN', periodEnd: { lte: now } },
        orderBy: { periodStart: 'asc' },
        include: SD_CONTRACT_PERIOD_INCLUDE,
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk contract periods', error))
    }
  },

  /**
   * Cria o período do ciclo se ainda não existe; corrida perdida devolve o
   * que o outro processo criou (`findByStart`).
   */
  async ensure(data: {
    workspaceId: string
    contractId: string
    periodStart: Date
    periodEnd: Date
    includedMinutes: number
  }): Promise<Result<SdContractPeriodWithRelations>> {
    try {
      const row = await prisma.sdContractPeriod.upsert({
        where: {
          contractId_periodStart: {
            contractId: data.contractId,
            periodStart: data.periodStart,
          },
        },
        create: data,
        update: {},
        include: SD_CONTRACT_PERIOD_INCLUDE,
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to open ServiceDesk contract period', error))
    }
  },

  async update(
    id: string,
    data: SdContractPeriodTotalsData,
  ): Promise<Result<SdContractPeriodWithRelations>> {
    try {
      const row = await prisma.sdContractPeriod.update({
        where: { id },
        data,
        include: SD_CONTRACT_PERIOD_INCLUDE,
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to update ServiceDesk contract period', error))
    }
  },
}
