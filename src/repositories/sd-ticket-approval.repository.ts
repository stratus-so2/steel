import type { Prisma } from '@prisma/client'
import { sdApprovalNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'
import { SD_USER_SUMMARY_SELECT } from './sd-ticket.repository'

export const SD_APPROVAL_INCLUDE = {
  approver: { select: SD_USER_SUMMARY_SELECT },
  requestedBy: { select: SD_USER_SUMMARY_SELECT },
} as const satisfies Prisma.SdTicketApprovalInclude

export type SdTicketApprovalWithRelations = Prisma.SdTicketApprovalGetPayload<{
  include: typeof SD_APPROVAL_INCLUDE
}>

const PUBLIC_INCLUDE = {
  ...SD_APPROVAL_INCLUDE,
  workspace: { select: { id: true, name: true, slug: true } },
  ticket: {
    select: {
      id: true,
      workspaceId: true,
      number: true,
      type: true,
      title: true,
      description: true,
      assigneeId: true,
      requesterId: true,
      departmentId: true,
      deletedAt: true,
      phase: { select: { name: true } },
      // Público das notificações de aprovação (motor em
      // `sd-notification.service.ts`).
      participants: { select: { userId: true } },
      contact: { select: { id: true, name: true, userId: true } },
    },
  },
} as const satisfies Prisma.SdTicketApprovalInclude

export type SdTicketApprovalWithTicket = Prisma.SdTicketApprovalGetPayload<{
  include: typeof PUBLIC_INCLUDE
}>

export interface SdTicketApprovalCreateData {
  workspaceId: string
  ticketId: string
  approverName: string | null
  approverEmail: string
  approverUserId: string | null
  tokenHash: string
  message: string | null
  requestedById: string
  expiresAt: Date
}

/** Pedidos de aprovação por e-mail. Sem regra de negócio. */
export const SdTicketApprovalRepository = {
  async list(
    ticketId: string,
  ): Promise<Result<SdTicketApprovalWithRelations[]>> {
    try {
      const rows = await prisma.sdTicketApproval.findMany({
        where: { ticketId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: SD_APPROVAL_INCLUDE,
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk approvals', error))
    }
  },

  async findById(
    id: string,
    ticketId: string,
  ): Promise<Result<SdTicketApprovalWithRelations>> {
    try {
      const row = await prisma.sdTicketApproval.findFirst({
        where: { id, ticketId },
        include: SD_APPROVAL_INCLUDE,
      })
      if (!row) return err(sdApprovalNotFound())
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk approval', error))
    }
  },

  async findByTokenHash(
    tokenHash: string,
  ): Promise<Result<SdTicketApprovalWithTicket>> {
    try {
      const row = await prisma.sdTicketApproval.findUnique({
        where: { tokenHash },
        include: PUBLIC_INCLUDE,
      })
      if (!row || row.ticket.deletedAt) return err(sdApprovalNotFound())
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk approval', error))
    }
  },

  /** Cria os pedidos (um por aprovador) numa transação. */
  async createMany(
    rows: SdTicketApprovalCreateData[],
  ): Promise<Result<SdTicketApprovalWithRelations[]>> {
    try {
      const created = await prisma.$transaction(
        rows.map((data) =>
          prisma.sdTicketApproval.create({
            data,
            include: SD_APPROVAL_INCLUDE,
          }),
        ),
      )
      return ok(created)
    } catch (error) {
      return err(dbError('Failed to create ServiceDesk approvals', error))
    }
  },

  async markSent(ids: string[], at: Date): Promise<Result<void>> {
    if (ids.length === 0) return ok(undefined)
    try {
      await prisma.sdTicketApproval.updateMany({
        where: { id: { in: ids } },
        data: { sentAt: at },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to mark ServiceDesk approvals sent', error))
    }
  },

  /**
   * Expira (lazy) os pedidos PENDING vencidos — de um chamado ou um só
   * pedido. Devolve quantos expiraram.
   */
  async expireOverdue(
    scope: { ticketId: string } | { id: string },
    now: Date,
  ): Promise<Result<number>> {
    try {
      const result = await prisma.sdTicketApproval.updateMany({
        where: { ...scope, status: 'PENDING', expiresAt: { lte: now } },
        data: { status: 'EXPIRED' },
      })
      return ok(result.count)
    } catch (error) {
      return err(dbError('Failed to expire ServiceDesk approvals', error))
    }
  },

  /** Novo link (reenvio): volta a PENDING com novo token e validade. */
  async renewToken(
    id: string,
    data: { tokenHash: string; expiresAt: Date },
  ): Promise<Result<SdTicketApprovalWithRelations>> {
    try {
      const row = await prisma.sdTicketApproval.update({
        where: { id },
        data: { ...data, status: 'PENDING', sentAt: null },
        include: SD_APPROVAL_INCLUDE,
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to renew ServiceDesk approval', error))
    }
  },

  /** Cancela se ainda PENDING. `false` = já não estava pendente. */
  async cancel(id: string): Promise<Result<boolean>> {
    try {
      const result = await prisma.sdTicketApproval.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'CANCELED' },
      })
      return ok(result.count > 0)
    } catch (error) {
      return err(dbError('Failed to cancel ServiceDesk approval', error))
    }
  },

  /**
   * Registra a resposta se o pedido ainda está PENDING e dentro da
   * validade, e cancela os outros pedidos **avulsos** pendentes do chamado (a
   * primeira resposta decide). `responded: false` = perdeu a corrida / não
   * pendente.
   *
   * Pedido de uma **rodada do comitê** (`roundId`) não cancela ninguém: a
   * rodada precisa dos outros votos para apurar o quórum e é ela que cancela
   * o que sobrou ao fechar (`SdApprovalRoundService`).
   */
  async respond(params: {
    id: string
    ticketId: string
    status: 'APPROVED' | 'REJECTED'
    comment: string | null
    at: Date
    /** Rodada do pedido; com rodada, os irmãos não são cancelados. */
    roundId?: string | null
  }): Promise<Result<{ responded: boolean; canceledIds: string[] }>> {
    try {
      return ok(
        await prisma.$transaction(async (tx) => {
          const updated = await tx.sdTicketApproval.updateMany({
            where: {
              id: params.id,
              status: 'PENDING',
              expiresAt: { gt: params.at },
            },
            data: {
              status: params.status,
              comment: params.comment,
              respondedAt: params.at,
            },
          })
          if (updated.count === 0) return { responded: false, canceledIds: [] }
          if (params.roundId) return { responded: true, canceledIds: [] }
          const siblings = await tx.sdTicketApproval.findMany({
            where: {
              ticketId: params.ticketId,
              roundId: null,
              status: 'PENDING',
              id: { not: params.id },
            },
            select: { id: true },
          })
          const canceledIds = siblings.map((s) => s.id)
          if (canceledIds.length > 0) {
            await tx.sdTicketApproval.updateMany({
              where: { id: { in: canceledIds } },
              data: { status: 'CANCELED' },
            })
          }
          return { responded: true, canceledIds }
        }),
      )
    } catch (error) {
      return err(dbError('Failed to respond ServiceDesk approval', error))
    }
  },
}
