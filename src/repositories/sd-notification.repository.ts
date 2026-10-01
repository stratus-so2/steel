import type {
  Prisma,
  SdNotificationChannel,
  SdNotificationPreference,
  SdPhaseCategory,
  SdTicketType,
} from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

/**
 * Central de notificações do ServiceDesk: preferências (evento × canal por
 * usuário), seguidores do chamado e as leituras que o motor de entrega
 * precisa (quem é agente, quem tem WhatsApp, destinatários do resumo).
 */

export interface SdNotificationUser {
  id: string
  name: string
  email: string
}

/** Fases que não contam como "na fila" do agente. */
const CLOSED_CATEGORIES: SdPhaseCategory[] = ['RESOLVED', 'CLOSED', 'CANCELED']

/** Chamados destacados no corpo do resumo. */
const DIGEST_HIGHLIGHTS = 5

export interface SdDigestHighlight {
  id: string
  number: number
  type: SdTicketType
  title: string
  resolutionDueAt: Date | null
}

export interface SdDigestCounts {
  queue: number
  atRisk: number
  waiting: number
  highlights: SdDigestHighlight[]
}

export interface SdTicketFollowerRow {
  userId: string
  createdAt: Date
  user: { id: string; name: string; email: string; image: string | null }
}

export const SdNotificationRepository = {
  /* ----------------------------- preferências ---------------------------- */

  async listPreferences(
    workspaceId: string,
    userId: string,
  ): Promise<Result<SdNotificationPreference[]>> {
    try {
      const rows = await prisma.sdNotificationPreference.findMany({
        where: { workspaceId, userId },
        orderBy: [{ event: 'asc' }, { channel: 'asc' }],
      })
      return ok(rows)
    } catch (error) {
      return err(
        dbError('Failed to list ServiceDesk notification prefs', error),
      )
    }
  },

  /** Preferências de vários usuários para um único evento. */
  async listPreferencesForEvent(
    workspaceId: string,
    userIds: string[],
    event: string,
  ): Promise<Result<SdNotificationPreference[]>> {
    const unique = Array.from(new Set(userIds))
    if (unique.length === 0) return ok([])
    try {
      const rows = await prisma.sdNotificationPreference.findMany({
        where: { workspaceId, event, userId: { in: unique } },
      })
      return ok(rows)
    } catch (error) {
      return err(
        dbError('Failed to read ServiceDesk notification prefs', error),
      )
    }
  },

  /** Grava a matriz inteira do usuário numa transação (upsert por célula). */
  async upsertPreferences(
    workspaceId: string,
    userId: string,
    items: {
      event: string
      channel: SdNotificationChannel
      enabled: boolean
    }[],
  ): Promise<Result<number>> {
    if (items.length === 0) return ok(0)
    try {
      await prisma.$transaction(
        items.map((item) =>
          prisma.sdNotificationPreference.upsert({
            where: {
              workspaceId_userId_event_channel: {
                workspaceId,
                userId,
                event: item.event,
                channel: item.channel,
              },
            },
            create: { workspaceId, userId, ...item },
            update: { enabled: item.enabled },
          }),
        ),
      )
      return ok(items.length)
    } catch (error) {
      return err(
        dbError('Failed to save ServiceDesk notification prefs', error),
      )
    }
  },

  /** Volta aos padrões do catálogo (apaga tudo o que o usuário salvou). */
  async deletePreferences(
    workspaceId: string,
    userId: string,
  ): Promise<Result<number>> {
    try {
      const result = await prisma.sdNotificationPreference.deleteMany({
        where: { workspaceId, userId },
      })
      return ok(result.count)
    } catch (error) {
      return err(
        dbError('Failed to reset ServiceDesk notification prefs', error),
      )
    }
  },

  /** Usuários do workspace com o resumo diário ligado num canal. */
  async listDigestUserIds(
    workspaceId: string,
    event: string,
    channel: SdNotificationChannel,
  ): Promise<Result<string[]>> {
    try {
      const rows = await prisma.sdNotificationPreference.findMany({
        where: { workspaceId, event, channel, enabled: true },
        select: { userId: true },
        orderBy: { userId: 'asc' },
      })
      return ok(rows.map((row) => row.userId))
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk digest users', error))
    }
  },

  /* ------------------------------ seguidores ----------------------------- */

  async listFollowers(
    ticketId: string,
  ): Promise<Result<SdTicketFollowerRow[]>> {
    try {
      const rows = await prisma.sdTicketFollower.findMany({
        where: { ticketId },
        orderBy: { createdAt: 'asc' },
        select: {
          userId: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk followers', error))
    }
  },

  async listFollowerIds(ticketId: string): Promise<Result<string[]>> {
    try {
      const rows = await prisma.sdTicketFollower.findMany({
        where: { ticketId },
        select: { userId: true },
        orderBy: { createdAt: 'asc' },
      })
      return ok(rows.map((row) => row.userId))
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk follower ids', error))
    }
  },

  /** Idempotente: `true` quando o vínculo é novo. */
  async addFollower(
    ticketId: string,
    userId: string,
  ): Promise<Result<boolean>> {
    try {
      const result = await prisma.sdTicketFollower.createMany({
        data: [{ ticketId, userId }],
        skipDuplicates: true,
      })
      return ok(result.count > 0)
    } catch (error) {
      return err(dbError('Failed to follow ServiceDesk ticket', error))
    }
  },

  /** Idempotente: `true` quando existia. */
  async removeFollower(
    ticketId: string,
    userId: string,
  ): Promise<Result<boolean>> {
    try {
      const result = await prisma.sdTicketFollower.deleteMany({
        where: { ticketId, userId },
      })
      return ok(result.count > 0)
    } catch (error) {
      return err(dbError('Failed to unfollow ServiceDesk ticket', error))
    }
  },

  /* -------------------------------- resumo ------------------------------- */

  /**
   * Contagens do resumo diário de um agente: chamados abertos na mão dele,
   * quantos estão com prazo vencido ou perto de vencer (`riskBefore`) e
   * quantos aguardam resposta de terceiros.
   */
  async digestCounts(
    workspaceId: string,
    userId: string,
    riskBefore: Date,
  ): Promise<Result<SdDigestCounts>> {
    const open: Prisma.SdTicketWhereInput = {
      workspaceId,
      assigneeId: userId,
      deletedAt: null,
      phase: { category: { notIn: CLOSED_CATEGORIES } },
    }
    try {
      const [queue, atRisk, waiting, oldest] = await Promise.all([
        prisma.sdTicket.count({ where: open }),
        prisma.sdTicket.count({
          where: {
            ...open,
            OR: [
              { resolutionBreached: true },
              { firstResponseBreached: true },
              { resolutionDueAt: { lte: riskBefore } },
              {
                firstResponseDueAt: { lte: riskBefore },
                firstRespondedAt: null,
              },
            ],
          },
        }),
        prisma.sdTicket.count({
          where: { ...open, phase: { category: 'WAITING' } },
        }),
        prisma.sdTicket.findMany({
          where: open,
          orderBy: [{ resolutionDueAt: { sort: 'asc', nulls: 'last' } }],
          take: DIGEST_HIGHLIGHTS,
          select: {
            id: true,
            number: true,
            type: true,
            title: true,
            resolutionDueAt: true,
          },
        }),
      ])
      return ok({ queue, atRisk, waiting, highlights: oldest })
    } catch (error) {
      return err(dbError('Failed to build ServiceDesk digest', error))
    }
  },

  /* ------------------------------- entrega ------------------------------- */

  /** Dentre `userIds`, os que atendem (membros de um departamento ativo). */
  async filterAgentIds(
    workspaceId: string,
    userIds: string[],
  ): Promise<Result<string[]>> {
    const unique = Array.from(new Set(userIds))
    if (unique.length === 0) return ok([])
    try {
      const rows = await prisma.sdDepartmentMember.findMany({
        where: {
          userId: { in: unique },
          department: { workspaceId, deletedAt: null, active: true },
        },
        select: { userId: true },
        distinct: ['userId'],
      })
      const agents = new Set(rows.map((row) => row.userId))
      return ok(unique.filter((id) => agents.has(id)))
    } catch (error) {
      return err(dbError('Failed to filter ServiceDesk agents', error))
    }
  },

  /** Nome e e-mail dos destinatários (só membros vivos do workspace). */
  async findRecipients(
    workspaceId: string,
    userIds: string[],
  ): Promise<Result<SdNotificationUser[]>> {
    const unique = Array.from(new Set(userIds))
    if (unique.length === 0) return ok([])
    try {
      const rows = await prisma.membership.findMany({
        where: { workspaceId, userId: { in: unique } },
        select: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { userId: 'asc' },
      })
      return ok(rows.map((row) => row.user))
    } catch (error) {
      return err(dbError('Failed to read ServiceDesk recipients', error))
    }
  },

  /** Canais de um contato externo (sem usuário da plataforma). */
  async findContactChannels(
    workspaceId: string,
    contactId: string,
  ): Promise<Result<{ email: string | null; whatsapp: string | null } | null>> {
    try {
      const row = await prisma.sdContact.findFirst({
        where: { id: contactId, workspaceId, deletedAt: null, active: true },
        select: { email: true, whatsapp: true },
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to read ServiceDesk contact channels', error))
    }
  },

  /**
   * Número de WhatsApp dos destinatários: o módulo guarda telefone no
   * contato (`SdContact`), não no usuário da plataforma.
   */
  async findWhatsappNumbers(
    workspaceId: string,
    userIds: string[],
  ): Promise<Result<Map<string, string>>> {
    const unique = Array.from(new Set(userIds))
    if (unique.length === 0) return ok(new Map())
    try {
      const rows = await prisma.sdContact.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          active: true,
          userId: { in: unique },
          whatsapp: { not: null },
        },
        select: { userId: true, whatsapp: true },
        orderBy: { updatedAt: 'desc' },
      })
      const map = new Map<string, string>()
      for (const row of rows) {
        if (row.userId && row.whatsapp && !map.has(row.userId)) {
          map.set(row.userId, row.whatsapp)
        }
      }
      return ok(map)
    } catch (error) {
      return err(dbError('Failed to read ServiceDesk WhatsApp numbers', error))
    }
  },
}
