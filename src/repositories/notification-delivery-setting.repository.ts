import type { NotificationDeliverySetting } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

/** Per-user delivery channels of the inbox (no row = defaults). */
export const NotificationDeliverySettingRepository = {
  async find(
    workspaceId: string,
    userId: string,
  ): Promise<Result<NotificationDeliverySetting | null>> {
    try {
      const row = await prisma.notificationDeliverySetting.findUnique({
        where: { userId_workspaceId: { userId, workspaceId } },
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find notification delivery setting', error))
    }
  },

  async upsert(
    workspaceId: string,
    userId: string,
    data: { browserEnabled: boolean },
  ): Promise<Result<NotificationDeliverySetting>> {
    try {
      const row = await prisma.notificationDeliverySetting.upsert({
        where: { userId_workspaceId: { userId, workspaceId } },
        create: { userId, workspaceId, ...data },
        update: data,
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to save notification delivery setting', error))
    }
  },
}
