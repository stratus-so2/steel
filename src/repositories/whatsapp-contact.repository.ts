import type { WhatsAppContact } from '@prisma/client'
import { conflict } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export type WhatsAppContactWithCount = WhatsAppContact & {
  _count: { conversations: number }
}

export const WhatsAppContactRepository = {
  async listByWorkspace(
    workspaceId: string,
    search?: string,
  ): Promise<Result<WhatsAppContactWithCount[]>> {
    try {
      const contacts = await prisma.whatsAppContact.findMany({
        where: {
          workspaceId,
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { waId: { contains: search } },
                ],
              }
            : {}),
        },
        include: { _count: { select: { conversations: true } } },
        orderBy: { name: 'asc' },
      })
      return ok(contacts)
    } catch (error) {
      return err(dbError('Failed to list whatsapp contacts', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<WhatsAppContact | null>> {
    try {
      const contact = await prisma.whatsAppContact.findFirst({
        where: { id, workspaceId },
      })
      return ok(contact)
    } catch (error) {
      return err(dbError('Failed to find whatsapp contact', error))
    }
  },

  async findByWaId(
    workspaceId: string,
    waId: string,
  ): Promise<Result<WhatsAppContact | null>> {
    try {
      const contact = await prisma.whatsAppContact.findUnique({
        where: { workspaceId_waId: { workspaceId, waId } },
      })
      return ok(contact)
    } catch (error) {
      return err(dbError('Failed to find whatsapp contact by wa_id', error))
    }
  },

  async findManyByWaIds(
    workspaceId: string,
    waIds: string[],
  ): Promise<Result<WhatsAppContact[]>> {
    if (waIds.length === 0) return ok([])
    try {
      const contacts = await prisma.whatsAppContact.findMany({
        where: { workspaceId, waId: { in: waIds } },
      })
      return ok(contacts)
    } catch (error) {
      return err(dbError('Failed to find whatsapp contacts by wa_ids', error))
    }
  },

  async create(data: {
    workspaceId: string
    waId: string
    name?: string
    avatarUrl?: string
    description?: string
  }): Promise<Result<WhatsAppContact>> {
    try {
      const contact = await prisma.whatsAppContact.create({ data })
      return ok(contact)
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        return err(conflict('Este contato já existe'))
      }
      return err(dbError('Failed to create whatsapp contact', error))
    }
  },

  async upsertByWaId(data: {
    workspaceId: string
    waId: string
    name?: string
    avatarUrl?: string
  }): Promise<Result<WhatsAppContact>> {
    try {
      const contact = await prisma.whatsAppContact.upsert({
        where: {
          workspaceId_waId: { workspaceId: data.workspaceId, waId: data.waId },
        },
        create: data,
        update: {
          ...(data.name ? { name: data.name } : {}),
          ...(data.avatarUrl ? { avatarUrl: data.avatarUrl } : {}),
        },
      })
      return ok(contact)
    } catch (error) {
      return err(dbError('Failed to upsert whatsapp contact', error))
    }
  },

  async update(
    id: string,
    data: { name?: string; avatarUrl?: string; description?: string },
  ): Promise<Result<WhatsAppContact>> {
    try {
      const contact = await prisma.whatsAppContact.update({
        where: { id },
        data,
      })
      return ok(contact)
    } catch (error) {
      return err(dbError('Failed to update whatsapp contact', error))
    }
  },

  async delete(id: string): Promise<Result<void>> {
    try {
      await prisma.whatsAppContact.delete({ where: { id } })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete whatsapp contact', error))
    }
  },
}
