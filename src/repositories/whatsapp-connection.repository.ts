import type { Prisma, WhatsAppConnection } from '@prisma/client'
import { whatsappConnectionConflict } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const WhatsAppConnectionRepository = {
  async listByWorkspace(
    workspaceId: string,
  ): Promise<Result<WhatsAppConnection[]>> {
    try {
      const connections = await prisma.whatsAppConnection.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'asc' },
      })
      return ok(connections)
    } catch (error) {
      return err(dbError('Failed to list whatsapp connections', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<WhatsAppConnection | null>> {
    try {
      const connection = await prisma.whatsAppConnection.findFirst({
        where: { id, workspaceId },
      })
      return ok(connection)
    } catch (error) {
      return err(dbError('Failed to find whatsapp connection', error))
    }
  },

  async findByZapiInstanceId(
    zapiInstanceId: string,
  ): Promise<Result<WhatsAppConnection | null>> {
    try {
      const connection = await prisma.whatsAppConnection.findFirst({
        where: { zapiInstanceId, provider: 'ZAPI' },
      })
      return ok(connection)
    } catch (error) {
      return err(
        dbError('Failed to find whatsapp connection by zapi instance', error),
      )
    }
  },

  async findByMetaPhoneNumberId(
    metaPhoneNumberId: string,
  ): Promise<Result<WhatsAppConnection | null>> {
    try {
      const connection = await prisma.whatsAppConnection.findFirst({
        where: { metaPhoneNumberId, provider: 'META' },
      })
      return ok(connection)
    } catch (error) {
      return err(
        dbError(
          'Failed to find whatsapp connection by meta phone number id',
          error,
        ),
      )
    }
  },

  async create(
    data: Prisma.WhatsAppConnectionUncheckedCreateInput,
  ): Promise<Result<WhatsAppConnection>> {
    try {
      const connection = await prisma.whatsAppConnection.create({ data })
      return ok(connection)
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        return err(whatsappConnectionConflict())
      }
      return err(dbError('Failed to create whatsapp connection', error))
    }
  },

  async update(
    id: string,
    data: Prisma.WhatsAppConnectionUpdateInput,
  ): Promise<Result<WhatsAppConnection>> {
    try {
      const connection = await prisma.whatsAppConnection.update({
        where: { id },
        data,
      })
      return ok(connection)
    } catch (error) {
      return err(dbError('Failed to update whatsapp connection', error))
    }
  },

  async delete(id: string): Promise<Result<void>> {
    try {
      await prisma.whatsAppConnection.delete({ where: { id } })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete whatsapp connection', error))
    }
  },
}
