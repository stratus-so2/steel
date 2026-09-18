import type { AdminAuditLog, Prisma } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export interface CreateAdminAuditLogInput {
  actorId: string
  actorEmail: string
  action: string
  targetType: string
  targetId?: string | null
  targetLabel?: string | null
  reason?: string | null
  meta?: Prisma.InputJsonValue
}

export const AdminAuditLogRepository = {
  async create(
    input: CreateAdminAuditLogInput,
  ): Promise<Result<AdminAuditLog>> {
    try {
      const entry = await prisma.adminAuditLog.create({ data: input })
      return ok(entry)
    } catch (error) {
      return err(dbError('Failed to create admin audit log', error))
    }
  },

  async listRecent(limit: number): Promise<Result<AdminAuditLog[]>> {
    try {
      const entries = await prisma.adminAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
      return ok(entries)
    } catch (error) {
      return err(dbError('Failed to list admin audit logs', error))
    }
  },

  async listByTarget(
    targetType: string,
    targetId: string,
    limit: number,
  ): Promise<Result<AdminAuditLog[]>> {
    try {
      const entries = await prisma.adminAuditLog.findMany({
        where: { targetType, targetId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
      return ok(entries)
    } catch (error) {
      return err(dbError('Failed to list admin audit logs by target', error))
    }
  },
}
