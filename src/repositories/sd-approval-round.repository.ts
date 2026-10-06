import type { Prisma, SdApprovalRoundStatus } from '@prisma/client'
import { sdApprovalRoundNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import type { Result } from '@/src/lib/result'
import { sdDb, sdDbFind } from './sd-config-db'
import { SD_USER_SUMMARY_SELECT } from './sd-ticket.repository'
import { SD_APPROVAL_INCLUDE } from './sd-ticket-approval.repository'

const include = {
  board: {
    select: {
      id: true,
      name: true,
      members: { select: { userId: true, required: true } },
    },
  },
  requestedBy: { select: SD_USER_SUMMARY_SELECT },
  approvals: {
    include: SD_APPROVAL_INCLUDE,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
} as const satisfies Prisma.SdApprovalRoundInclude

export type SdApprovalRoundWithRelations = Prisma.SdApprovalRoundGetPayload<{
  include: typeof include
}>

/** Um pedido da rodada, já resolvido (membro do comitê + token). */
export interface SdApprovalRoundMemberData {
  approverName: string | null
  approverEmail: string
  approverUserId: string
  tokenHash: string
  /** Voto obrigatório: a rodada não fecha sem ele. */
  required: boolean
}

const OPEN: SdApprovalRoundStatus = 'PENDING'

/** Rodada movida para EXPIRED por uma expiração lazy. */
export interface SdExpiredApprovalRound {
  id: string
  workspaceId: string
  ticketId: string
  requestedById: string
  boardName: string | null
}

/**
 * Rodadas de aprovação do CAB (`SdApprovalRound`). A rodada e os pedidos
 * (`SdTicketApproval.roundId`) nascem na mesma transação; a contagem de votos
 * e o fechamento (quórum, `rejectEnds`, membros obrigatórios) são regra de
 * negócio e moram no service.
 */
export const SdApprovalRoundRepository = {
  async listByTicket(
    ticketId: string,
  ): Promise<Result<SdApprovalRoundWithRelations[]>> {
    return sdDb('Failed to list ServiceDesk approval rounds', () =>
      prisma.sdApprovalRound.findMany({
        where: { ticketId },
        include,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    )
  },

  async findById(
    id: string,
    ticketId: string,
  ): Promise<Result<SdApprovalRoundWithRelations>> {
    return sdDbFind(
      'Failed to find ServiceDesk approval round',
      () =>
        prisma.sdApprovalRound.findFirst({
          where: { id, ticketId },
          include,
        }),
      sdApprovalRoundNotFound(),
    )
  },

  /** Rodada de um pedido (resposta pelo link público). */
  async findByApprovalId(
    approvalId: string,
  ): Promise<Result<SdApprovalRoundWithRelations | null>> {
    return sdDb('Failed to find ServiceDesk approval round', async () => {
      const row = await prisma.sdApprovalRound.findFirst({
        where: { approvals: { some: { id: approvalId } } },
        include,
      })
      return row
    })
  },

  /** `true` quando o chamado tem ao menos uma rodada aprovada. */
  async hasApprovedRound(ticketId: string): Promise<Result<boolean>> {
    return sdDb('Failed to count ServiceDesk approved rounds', async () => {
      const count = await prisma.sdApprovalRound.count({
        where: { ticketId, status: 'APPROVED' },
      })
      return count > 0
    })
  },

  /** A rodada aberta do chamado, se houver (só uma por vez). */
  async findOpenByTicket(
    ticketId: string,
  ): Promise<Result<SdApprovalRoundWithRelations | null>> {
    return sdDb('Failed to find ServiceDesk open approval round', async () => {
      const row = await prisma.sdApprovalRound.findFirst({
        where: { ticketId, status: OPEN },
        include,
        orderBy: { createdAt: 'desc' },
      })
      return row
    })
  },

  /** Cria a rodada e um `SdTicketApproval` por membro, numa transação. */
  async open(params: {
    workspaceId: string
    ticketId: string
    boardId: string | null
    quorum: number
    rejectEnds: boolean
    requestedById: string
    message: string | null
    expiresAt: Date
    members: SdApprovalRoundMemberData[]
  }): Promise<Result<SdApprovalRoundWithRelations>> {
    return sdDb('Failed to open ServiceDesk approval round', () =>
      prisma.sdApprovalRound.create({
        data: {
          workspaceId: params.workspaceId,
          ticketId: params.ticketId,
          boardId: params.boardId,
          quorum: params.quorum,
          rejectEnds: params.rejectEnds,
          requestedById: params.requestedById,
          approvals: {
            create: params.members.map((member) => ({
              workspaceId: params.workspaceId,
              ticketId: params.ticketId,
              approverName: member.approverName,
              approverEmail: member.approverEmail,
              approverUserId: member.approverUserId,
              tokenHash: member.tokenHash,
              message: params.message,
              requestedById: params.requestedById,
              expiresAt: params.expiresAt,
            })),
          },
        },
        include,
      }),
    )
  },

  /** Fecha a rodada se ainda aberta. `false` = perdeu a corrida. */
  async close(
    id: string,
    status: Exclude<SdApprovalRoundStatus, 'PENDING'>,
    at: Date,
  ): Promise<Result<boolean>> {
    return sdDb('Failed to close ServiceDesk approval round', async () => {
      const result = await prisma.sdApprovalRound.updateMany({
        where: { id, status: OPEN },
        data: { status, decidedAt: at },
      })
      return result.count > 0
    })
  },

  /**
   * Cancela os pedidos ainda pendentes da rodada (quórum batido ou rodada
   * cancelada) e devolve quantos foram.
   */
  async cancelPendingApprovals(id: string): Promise<Result<number>> {
    return sdDb('Failed to cancel ServiceDesk round approvals', async () => {
      const result = await prisma.sdTicketApproval.updateMany({
        where: { roundId: id, status: 'PENDING' },
        data: { status: 'CANCELED' },
      })
      return result.count
    })
  },

  /**
   * Expira (lazy) as rodadas abertas cujos pedidos todos venceram, junto com
   * os pedidos. Devolve as rodadas que **esta** chamada expirou (a troca de
   * status é condicional, então duas chamadas concorrentes não devolvem a
   * mesma rodada).
   */
  async expireOverdue(
    ticketId: string,
    now: Date,
  ): Promise<Result<SdExpiredApprovalRound[]>> {
    return sdDb('Failed to expire ServiceDesk approval rounds', async () => {
      const open = await prisma.sdApprovalRound.findMany({
        where: { ticketId, status: OPEN },
        select: {
          id: true,
          approvals: { select: { status: true, expiresAt: true } },
        },
      })
      const stale = open
        .filter((round) =>
          round.approvals.every(
            (a) => a.status !== 'PENDING' || a.expiresAt <= now,
          ),
        )
        .filter((round) =>
          round.approvals.some(
            (a) => a.status === 'PENDING' && a.expiresAt <= now,
          ),
        )
      if (stale.length === 0) return []
      const ids = stale.map((round) => round.id)
      return prisma.$transaction(async (tx) => {
        const expired = await tx.sdApprovalRound.updateManyAndReturn({
          where: { id: { in: ids }, status: OPEN },
          data: { status: 'EXPIRED', decidedAt: now },
          select: {
            id: true,
            workspaceId: true,
            ticketId: true,
            requestedById: true,
            board: { select: { name: true } },
          },
        })
        if (expired.length > 0) {
          await tx.sdTicketApproval.updateMany({
            where: {
              roundId: { in: expired.map((round) => round.id) },
              status: 'PENDING',
            },
            data: { status: 'EXPIRED' },
          })
        }
        return expired.map((round) => ({
          id: round.id,
          workspaceId: round.workspaceId,
          ticketId: round.ticketId,
          requestedById: round.requestedById,
          boardName: round.board?.name ?? null,
        }))
      })
    })
  },

  /** Rodadas abertas do chamado, só os ids (cancelamento em lote). */
  async listOpenIds(ticketId: string): Promise<Result<string[]>> {
    return sdDb('Failed to list ServiceDesk open approval rounds', async () => {
      const rows = await prisma.sdApprovalRound.findMany({
        where: { ticketId, status: OPEN },
        select: { id: true },
      })
      return rows.map((row) => row.id)
    })
  },
}
