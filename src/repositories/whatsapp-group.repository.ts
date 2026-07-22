import type { Prisma, WhatsAppGroup } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

const groupListInclude = {
  participants: true,
  messages: { orderBy: { createdAt: 'desc' as const }, take: 1 },
} satisfies Prisma.WhatsAppGroupInclude

export type WhatsAppGroupWithParticipants = Prisma.WhatsAppGroupGetPayload<{
  include: typeof groupListInclude
}>

export const WhatsAppGroupRepository = {
  async listByWorkspace(
    workspaceId: string,
    filters: { archived?: boolean } = {},
  ): Promise<Result<WhatsAppGroupWithParticipants[]>> {
    try {
      const groups = await prisma.whatsAppGroup.findMany({
        where: {
          workspaceId,
          archivedAt: filters.archived ? { not: null } : null,
        },
        include: groupListInclude,
        orderBy: { lastMessageAt: 'desc' },
      })
      return ok(groups)
    } catch (error) {
      return err(dbError('Failed to list whatsapp groups', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<WhatsAppGroupWithParticipants | null>> {
    try {
      const group = await prisma.whatsAppGroup.findFirst({
        where: { id, workspaceId },
        include: groupListInclude,
      })
      return ok(group)
    } catch (error) {
      return err(dbError('Failed to find whatsapp group', error))
    }
  },

  async findByGroupJid(
    workspaceId: string,
    groupJid: string,
  ): Promise<Result<WhatsAppGroup | null>> {
    try {
      const group = await prisma.whatsAppGroup.findUnique({
        where: { workspaceId_groupJid: { workspaceId, groupJid } },
      })
      return ok(group)
    } catch (error) {
      return err(dbError('Failed to find whatsapp group by jid', error))
    }
  },

  async create(
    data: Prisma.WhatsAppGroupUncheckedCreateInput,
  ): Promise<Result<WhatsAppGroup>> {
    try {
      const group = await prisma.whatsAppGroup.create({ data })
      return ok(group)
    } catch (error) {
      return err(dbError('Failed to create whatsapp group', error))
    }
  },

  async update(
    id: string,
    data: Prisma.WhatsAppGroupUncheckedUpdateInput,
  ): Promise<Result<WhatsAppGroup>> {
    try {
      const group = await prisma.whatsAppGroup.update({ where: { id }, data })
      return ok(group)
    } catch (error) {
      return err(dbError('Failed to update whatsapp group', error))
    }
  },

  async upsertParticipantName(
    groupId: string,
    waId: string,
    name: string,
  ): Promise<Result<void>> {
    try {
      await prisma.whatsAppGroupParticipant.updateMany({
        where: { groupId, waId },
        data: { name },
      })
      return ok(undefined)
    } catch (error) {
      return err(
        dbError('Failed to update whatsapp group participant name', error),
      )
    }
  },

  async replaceParticipants(
    groupId: string,
    participants: {
      waId: string
      name?: string
      role: 'MEMBER' | 'ADMIN'
    }[],
  ): Promise<Result<void>> {
    try {
      await prisma.$transaction([
        prisma.whatsAppGroupParticipant.deleteMany({ where: { groupId } }),
        prisma.whatsAppGroupParticipant.createMany({
          data: participants.map((p) => ({ groupId, ...p })),
        }),
      ])
      return ok(undefined)
    } catch (error) {
      return err(
        dbError('Failed to replace whatsapp group participants', error),
      )
    }
  },
}
