import type { Prisma } from '@prisma/client'
import { sdSignatureNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { sdLineTotal, sdMoney, sdSum } from '@/src/lib/servicedesk/money'
import { dbError } from './db-error'
import { SD_USER_SUMMARY_SELECT } from './sd-ticket.repository'

export const SD_SIGNATURE_INCLUDE = {
  signedBy: { select: SD_USER_SUMMARY_SELECT },
} as const satisfies Prisma.SdTicketSignatureInclude

export type SdTicketSignatureWithRelations =
  Prisma.SdTicketSignatureGetPayload<{
    include: typeof SD_SIGNATURE_INCLUDE
  }>

export interface SdTicketSignatureCreateData {
  id: string
  workspaceId: string
  ticketId: string
  purpose: string
  signerName: string
  signerDocument: string | null
  signerEmail: string | null
  signedById: string
  storageKey: string
  imageSha256: string
  ticketSha256: string
  signedAt: Date
}

/** Totais usados no snapshot de integridade do chamado. */
export interface SdTicketSignatureTotals {
  /** Soma de quantidade × custo unitário dos custos (2 casas). */
  costs: string
  /** Soma das peças ativas (sem canceladas/devolvidas). */
  parts: string
}

/** Assinaturas do chamado. Sem regra de negócio. */
export const SdTicketSignatureRepository = {
  async list(
    ticketId: string,
  ): Promise<Result<SdTicketSignatureWithRelations[]>> {
    try {
      const rows = await prisma.sdTicketSignature.findMany({
        where: { ticketId },
        orderBy: { signedAt: 'desc' },
        include: SD_SIGNATURE_INCLUDE,
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk signatures', error))
    }
  },

  async findById(
    id: string,
    ticketId: string,
  ): Promise<Result<SdTicketSignatureWithRelations>> {
    try {
      const row = await prisma.sdTicketSignature.findFirst({
        where: { id, ticketId },
        include: SD_SIGNATURE_INCLUDE,
      })
      if (!row) return err(sdSignatureNotFound())
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk signature', error))
    }
  },

  async create(
    data: SdTicketSignatureCreateData,
  ): Promise<Result<SdTicketSignatureWithRelations>> {
    try {
      const row = await prisma.sdTicketSignature.create({
        data,
        include: SD_SIGNATURE_INCLUDE,
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to create ServiceDesk signature', error))
    }
  },

  /** Totais de custos e peças do chamado (para o snapshot assinado). */
  async ticketTotals(
    ticketId: string,
  ): Promise<Result<SdTicketSignatureTotals>> {
    try {
      const [costs, parts] = await Promise.all([
        prisma.sdTicketCost.findMany({
          where: { ticketId },
          select: { quantity: true, unitCost: true },
        }),
        prisma.sdTicketPart.findMany({
          where: { ticketId, status: { notIn: ['CANCELED', 'RETURNED'] } },
          select: { quantity: true, unitCost: true },
        }),
      ])
      return ok({
        costs: sdMoney(
          sdSum(costs.map((c) => sdLineTotal(c.quantity, c.unitCost))),
        ),
        parts: sdMoney(
          sdSum(parts.map((p) => sdLineTotal(p.quantity, p.unitCost))),
        ),
      })
    } catch (error) {
      return err(dbError('Failed to total ServiceDesk ticket', error))
    }
  },
}
