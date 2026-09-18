import type { Prisma, WhatsAppConversation } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

const conversationListInclude = {
  contact: true,
  messages: { orderBy: { createdAt: 'desc' as const }, take: 1 },
} satisfies Prisma.WhatsAppConversationInclude

export type WhatsAppConversationWithPreview =
  Prisma.WhatsAppConversationGetPayload<{
    include: typeof conversationListInclude
  }>

export type WhatsAppConversationWithConnection =
  Prisma.WhatsAppConversationGetPayload<{ include: { connection: true } }>

/** Filtro de status da listagem: um status exato ou `OPEN` (não fechadas —
 * a caixa de entrada ativa). */
export type WhatsAppConversationStatusFilter =
  | 'NEW'
  | 'IN_PROGRESS'
  | 'CLOSED'
  | 'OPEN'

export const WhatsAppConversationRepository = {
  async listByWorkspace(
    workspaceId: string,
    filters: {
      status?: WhatsAppConversationStatusFilter
      assignedUserId?: string
      archived?: boolean
      connectionId?: string
    } = {},
  ): Promise<Result<WhatsAppConversationWithPreview[]>> {
    try {
      const conversations = await prisma.whatsAppConversation.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          archivedAt: filters.archived ? { not: null } : null,
          ...(filters.status === 'OPEN'
            ? { status: { in: ['NEW' as const, 'IN_PROGRESS' as const] } }
            : filters.status
              ? { status: filters.status }
              : {}),
          ...(filters.assignedUserId
            ? { assignedUserId: filters.assignedUserId }
            : {}),
          ...(filters.connectionId
            ? { connectionId: filters.connectionId }
            : {}),
        },
        include: conversationListInclude,
        orderBy: [
          { pinnedAt: { sort: 'desc', nulls: 'last' } },
          { lastMessageAt: 'desc' },
        ],
      })
      return ok(conversations)
    } catch (error) {
      return err(dbError('Failed to list whatsapp conversations', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<WhatsAppConversationWithPreview | null>> {
    try {
      const conversation = await prisma.whatsAppConversation.findFirst({
        where: { id, workspaceId },
        include: conversationListInclude,
      })
      return ok(conversation)
    } catch (error) {
      return err(dbError('Failed to find whatsapp conversation', error))
    }
  },

  async findByIdRaw(id: string): Promise<Result<WhatsAppConversation | null>> {
    try {
      const conversation = await prisma.whatsAppConversation.findUnique({
        where: { id },
      })
      return ok(conversation)
    } catch (error) {
      return err(dbError('Failed to find whatsapp conversation', error))
    }
  },

  /** Sem escopo de workspace: uso exclusivo de jobs em background, que só
   * recebem o id da conversa no payload. */
  async findByIdWithConnection(
    id: string,
  ): Promise<Result<WhatsAppConversationWithConnection | null>> {
    try {
      const conversation = await prisma.whatsAppConversation.findUnique({
        where: { id },
        include: { connection: true },
      })
      return ok(conversation)
    } catch (error) {
      return err(dbError('Failed to find whatsapp conversation', error))
    }
  },

  async findActiveByContact(
    workspaceId: string,
    contactId: string,
  ): Promise<Result<WhatsAppConversation | null>> {
    try {
      const conversation = await prisma.whatsAppConversation.findFirst({
        where: {
          workspaceId,
          contactId,
          status: { in: ['NEW', 'IN_PROGRESS'] },
        },
        orderBy: { createdAt: 'desc' },
      })
      return ok(conversation)
    } catch (error) {
      return err(dbError('Failed to find active whatsapp conversation', error))
    }
  },

  /** Conversa fechada mais recente do contato (não excluída) — reaberta
   * quando o contato volta a escrever. */
  async findLatestClosedByContact(
    workspaceId: string,
    contactId: string,
  ): Promise<Result<WhatsAppConversation | null>> {
    try {
      const conversation = await prisma.whatsAppConversation.findFirst({
        where: { workspaceId, contactId, status: 'CLOSED', deletedAt: null },
        orderBy: { updatedAt: 'desc' },
      })
      return ok(conversation)
    } catch (error) {
      return err(dbError('Failed to find closed whatsapp conversation', error))
    }
  },

  /**
   * Conversas abertas (NEW/IN_PROGRESS, não excluídas) sem mensagem desde
   * `cutoff`. Conversa limpa (`lastMessageAt` nulo) usa `updatedAt`.
   * `workspaceIds` restringe (`in`) ou exclui (`notIn`) workspaces.
   */
  async listInactiveOpen(input: {
    cutoff: Date
    workspaceIds: { in: string[] } | { notIn: string[] }
    limit: number
  }): Promise<Result<WhatsAppConversation[]>> {
    try {
      const conversations = await prisma.whatsAppConversation.findMany({
        where: {
          workspaceId: input.workspaceIds,
          deletedAt: null,
          status: { in: ['NEW', 'IN_PROGRESS'] },
          OR: [
            { lastMessageAt: { lt: input.cutoff } },
            { lastMessageAt: null, updatedAt: { lt: input.cutoff } },
          ],
        },
        orderBy: { lastMessageAt: 'asc' },
        take: input.limit,
      })
      return ok(conversations)
    } catch (error) {
      return err(
        dbError('Failed to list inactive whatsapp conversations', error),
      )
    }
  },

  async create(
    data: Prisma.WhatsAppConversationUncheckedCreateInput,
  ): Promise<Result<WhatsAppConversation>> {
    try {
      const conversation = await prisma.whatsAppConversation.create({ data })
      return ok(conversation)
    } catch (error) {
      return err(dbError('Failed to create whatsapp conversation', error))
    }
  },

  async update(
    id: string,
    data: Prisma.WhatsAppConversationUncheckedUpdateInput,
  ): Promise<Result<WhatsAppConversation>> {
    try {
      const conversation = await prisma.whatsAppConversation.update({
        where: { id },
        data,
      })
      return ok(conversation)
    } catch (error) {
      return err(dbError('Failed to update whatsapp conversation', error))
    }
  },
}
