import type { WorkspaceAiSettings, WorkspaceStatus } from '@prisma/client'
import type { UtcRange } from '@/src/lib/ai/usage-period'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import type { AiUsageWeeklyAgentsDTO } from '@/types/ai-usage'
import { dbError } from './db-error'

export interface AiUsageWeeklyWorkspace {
  id: string
  name: string
  slug: string
  status: WorkspaceStatus
  aiSettings: WorkspaceAiSettings | null
}

export interface AiUsageWeeklyRecipient {
  id: string
  name: string
  email: string
}

/**
 * Reads behind the weekly Steel AI usage e-mail (`ai-usage-weekly-email`
 * queue). The ledger aggregates themselves come from
 * `AiUsageAnalyticsRepository`, shared with the "Uso" and "Análises" pages.
 */
export const AiUsageWeeklyEmailRepository = {
  /** Workspaces with at least one ledger row in `[from, to)`. */
  async listWorkspaceIdsWithUsage(range: UtcRange): Promise<Result<string[]>> {
    try {
      const groups = await prisma.aiUsage.groupBy({
        by: ['workspaceId'],
        where: { createdAt: { gte: range.from, lt: range.to } },
        orderBy: { workspaceId: 'asc' },
      })
      return ok(groups.map((group) => group.workspaceId))
    } catch (error) {
      return err(dbError('Failed to list workspaces with AI usage', error))
    }
  },

  /** Workspaces (with their AI settings row, if any) by id. */
  async findWorkspaces(
    ids: string[],
  ): Promise<Result<AiUsageWeeklyWorkspace[]>> {
    if (ids.length === 0) return ok([])
    try {
      const rows = await prisma.workspace.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          aiSettings: true,
        },
        orderBy: { id: 'asc' },
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to find workspaces for the AI e-mail', error))
    }
  },

  /** OWNERs of the workspace, minus accounts scheduled for deletion. */
  async listOwners(
    workspaceId: string,
  ): Promise<Result<AiUsageWeeklyRecipient[]>> {
    try {
      const memberships = await prisma.membership.findMany({
        where: {
          workspaceId,
          role: 'OWNER',
          user: { deletionScheduledAt: null },
        },
        select: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      })
      return ok(memberships.map((membership) => membership.user))
    } catch (error) {
      return err(dbError('Failed to list workspace owners', error))
    }
  },

  /**
   * Steel Agents in the week: runs created, successful agent writes, and
   * agent approvals still pending (not expired) at `now`.
   */
  async agentActivity(
    workspaceId: string,
    range: UtcRange,
    now: Date,
  ): Promise<Result<AiUsageWeeklyAgentsDTO>> {
    const createdAt = { gte: range.from, lt: range.to }
    try {
      const [runs, actions, pendingApprovals] = await Promise.all([
        prisma.steelAgentRun.count({ where: { workspaceId, createdAt } }),
        prisma.aiActionLog.count({
          where: {
            workspaceId,
            source: 'AGENT',
            outcome: 'success',
            createdAt,
          },
        }),
        prisma.aiPendingAction.count({
          where: {
            workspaceId,
            status: 'PENDING',
            agentRunId: { not: null },
            expiresAt: { gt: now },
          },
        }),
      ])
      return ok({ runs, actions, pendingApprovals })
    } catch (error) {
      return err(dbError('Failed to count Steel Agents activity', error))
    }
  },
}
