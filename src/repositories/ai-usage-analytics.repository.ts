import type { AiUsageFeature, ModuleKind, Prisma } from '@prisma/client'
import type { UtcRange } from '@/src/lib/ai/usage-period'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

/** Cost of one UTC day: the given user's and the whole workspace's. */
export interface AiUsageDailyCost {
  /** `YYYY-MM-DD` (UTC). */
  day: string
  mineUsd: number
  workspaceUsd: number
}

/** Totals of one group of ledger rows (dimensions present per query). */
export interface AiUsageGroupRow {
  provider?: string
  model?: string
  feature?: AiUsageFeature
  module?: ModuleKind | null
  userId?: string | null
  costUsd: number
  inputTokens: number
  outputTokens: number
  calls: number
}

export interface AiUsageExportRow {
  id: string
  createdAt: Date
  userId: string | null
  userName: string | null
  userEmail: string | null
  feature: AiUsageFeature
  provider: string
  model: string
  module: ModuleKind | null
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export interface AiUsageUserRow {
  id: string
  name: string
  email: string
}

function where(
  workspaceId: string,
  range: UtcRange,
  userId?: string,
): Prisma.AiUsageWhereInput {
  return {
    workspaceId,
    createdAt: { gte: range.from, lt: range.to },
    ...(userId ? { userId } : {}),
  }
}

type GroupResult = {
  _sum: {
    costUsd: Prisma.Decimal | null
    inputTokens: number | null
    outputTokens: number | null
  }
  _count: { _all: number }
}

function totals(group: GroupResult) {
  return {
    costUsd: group._sum.costUsd?.toNumber() ?? 0,
    inputTokens: group._sum.inputTokens ?? 0,
    outputTokens: group._sum.outputTokens ?? 0,
    calls: group._count._all,
  }
}

const SUMS = {
  _sum: { costUsd: true, inputTokens: true, outputTokens: true },
  _count: { _all: true },
} as const

/**
 * Read side of the AI usage ledger (`ai_usage`) for the Steel AI "Uso" and
 * "Análises" pages. Days are UTC — the same clock as the monthly quota.
 */
export const AiUsageAnalyticsRepository = {
  /**
   * Cost per UTC day in `[from, to)`: the workspace total and the share of
   * `userId` (0 without one). `created_at` is a UTC `timestamp`; the bounds
   * go as ISO text cast to `timestamp`, which drops the `Z` and keeps the
   * UTC wall time whatever the session time zone is.
   */
  async dailyCosts(
    workspaceId: string,
    range: UtcRange,
    userId?: string,
  ): Promise<Result<AiUsageDailyCost[]>> {
    try {
      const rows = await prisma.$queryRaw<
        { day: string; mine_usd: number; workspace_usd: number }[]
      >`
        SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
               coalesce(sum(cost_usd) FILTER (WHERE user_id = ${userId ?? ''}), 0)::float8 AS mine_usd,
               coalesce(sum(cost_usd), 0)::float8 AS workspace_usd
        FROM ai_usage
        WHERE workspace_id = ${workspaceId}
          AND created_at >= ${range.from.toISOString()}::timestamp
          AND created_at < ${range.to.toISOString()}::timestamp
        GROUP BY 1
        ORDER BY 1`
      return ok(
        rows.map((row) => ({
          day: row.day,
          mineUsd: Number(row.mine_usd),
          workspaceUsd: Number(row.workspace_usd),
        })),
      )
    } catch (error) {
      return err(dbError('Failed to aggregate AI usage per day', error))
    }
  },

  /** Totals grouped by (provider, model, feature, module). */
  async groupByDimensions(
    workspaceId: string,
    range: UtcRange,
    userId?: string,
  ): Promise<Result<AiUsageGroupRow[]>> {
    try {
      const groups = await prisma.aiUsage.groupBy({
        by: ['provider', 'model', 'feature', 'module'],
        where: where(workspaceId, range, userId),
        ...SUMS,
      })
      return ok(
        groups.map((group) => ({
          provider: group.provider,
          model: group.model,
          feature: group.feature,
          module: group.module,
          ...totals(group),
        })),
      )
    } catch (error) {
      return err(dbError('Failed to group AI usage', error))
    }
  },

  /** Totals per user (`null` = background jobs). */
  async groupByUser(
    workspaceId: string,
    range: UtcRange,
  ): Promise<Result<AiUsageGroupRow[]>> {
    try {
      const groups = await prisma.aiUsage.groupBy({
        by: ['userId'],
        where: where(workspaceId, range),
        ...SUMS,
      })
      return ok(
        groups.map((group) => ({ userId: group.userId, ...totals(group) })),
      )
    } catch (error) {
      return err(dbError('Failed to group AI usage by user', error))
    }
  },

  async findUsers(ids: string[]): Promise<Result<AiUsageUserRow[]>> {
    if (ids.length === 0) return ok([])
    try {
      const users = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, email: true },
      })
      return ok(users)
    } catch (error) {
      return err(dbError('Failed to find AI usage users', error))
    }
  },

  /**
   * One page of ledger rows for the CSV export, oldest first. Keyset by
   * `(createdAt, id)` through the `id` cursor: pass the last id of the
   * previous page.
   */
  async exportPage(
    workspaceId: string,
    range: UtcRange,
    options: { userId?: string; cursor?: string; take: number },
  ): Promise<Result<AiUsageExportRow[]>> {
    try {
      const rows = await prisma.aiUsage.findMany({
        where: where(workspaceId, range, options.userId),
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: options.take,
        ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
        include: { user: { select: { name: true, email: true } } },
      })
      return ok(
        rows.map((row) => ({
          id: row.id,
          createdAt: row.createdAt,
          userId: row.userId,
          userName: row.user?.name ?? null,
          userEmail: row.user?.email ?? null,
          feature: row.feature,
          provider: row.provider,
          model: row.model,
          module: row.module,
          inputTokens: row.inputTokens,
          outputTokens: row.outputTokens,
          costUsd: row.costUsd.toNumber(),
        })),
      )
    } catch (error) {
      return err(dbError('Failed to page AI usage rows', error))
    }
  },
}
