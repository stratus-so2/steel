import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import type { AdminOverviewDTO } from '@/types/admin-workspace'
import { dbError } from './db-error'

const DAY = 86_400_000

export const AdminOverviewRepository = {
  async workspaceCounts(
    now: Date,
  ): Promise<Result<AdminOverviewDTO['workspaces']>> {
    try {
      const last30 = new Date(now.getTime() - 30 * DAY)
      const prev30 = new Date(now.getTime() - 60 * DAY)
      const [byStatus, trial, createdLast30d, createdPrev30d] =
        await Promise.all([
          prisma.workspace.groupBy({ by: ['status'], _count: { _all: true } }),
          prisma.workspace.count({
            where: { status: 'ACTIVE', trialEndsAt: { gt: now } },
          }),
          prisma.workspace.count({ where: { createdAt: { gte: last30 } } }),
          prisma.workspace.count({
            where: { createdAt: { gte: prev30, lt: last30 } },
          }),
        ])
      const count = (status: string) =>
        byStatus.find((row) => row.status === status)?._count._all ?? 0
      return ok({
        total: byStatus.reduce((sum, row) => sum + row._count._all, 0),
        active: count('ACTIVE'),
        suspended: count('SUSPENDED'),
        deleting: count('DELETING'),
        trial,
        createdLast30d,
        createdPrev30d,
      })
    } catch (error) {
      return err(dbError('Failed to count workspaces for overview', error))
    }
  },

  async userCounts(now: Date): Promise<Result<AdminOverviewDTO['users']>> {
    try {
      const last7 = new Date(now.getTime() - 7 * DAY)
      const prev7 = new Date(now.getTime() - 14 * DAY)
      const [total, createdLast7d, createdPrev7d] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { createdAt: { gte: last7 } } }),
        prisma.user.count({ where: { createdAt: { gte: prev7, lt: last7 } } }),
      ])
      return ok({ total, createdLast7d, createdPrev7d })
    } catch (error) {
      return err(dbError('Failed to count users for overview', error))
    }
  },

  async recentSignups(
    limit: number,
  ): Promise<Result<AdminOverviewDTO['recentSignups']>> {
    try {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { id: true, name: true, email: true, createdAt: true },
      })
      return ok(
        users.map((user) => ({
          ...user,
          createdAt: user.createdAt.toISOString(),
        })),
      )
    } catch (error) {
      return err(dbError('Failed to list recent signups', error))
    }
  },
}
