import type { Notification, Prisma } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const NotificationRepository = {
  async createMany(
    data: Prisma.NotificationCreateManyInput[],
  ): Promise<Result<number>> {
    if (data.length === 0) return ok(0)
    try {
      const result = await prisma.notification.createMany({ data })
      return ok(result.count)
    } catch (error) {
      return err(dbError('Failed to create notifications', error))
    }
  },

  async listByUser(
    workspaceId: string,
    userId: string,
    limit: number,
  ): Promise<Result<Notification[]>> {
    try {
      const rows = await prisma.notification.findMany({
        where: { workspaceId, userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list notifications', error))
    }
  },

  async countUnread(
    workspaceId: string,
    userId: string,
  ): Promise<Result<number>> {
    try {
      const count = await prisma.notification.count({
        where: { workspaceId, userId, readAt: null },
      })
      return ok(count)
    } catch (error) {
      return err(dbError('Failed to count unread notifications', error))
    }
  },

  /** Marca como lidas as notificações do próprio usuário (todas, ou só
   * `ids`). Ids de outro usuário/workspace são ignorados pelo filtro. */
  async markRead(
    workspaceId: string,
    userId: string,
    ids?: string[],
  ): Promise<Result<number>> {
    try {
      const result = await prisma.notification.updateMany({
        where: {
          workspaceId,
          userId,
          readAt: null,
          ...(ids ? { id: { in: ids } } : {}),
        },
        data: { readAt: new Date() },
      })
      return ok(result.count)
    } catch (error) {
      return err(dbError('Failed to mark notifications as read', error))
    }
  },
}
