import { logFields } from '@/lib/axiom/log-fields'
import { logger } from '@/lib/axiom/logger'
import { baseEmailUrl } from '@/lib/base-email-url'
import { AiUsageWeeklyEmailCache } from '@/src/cache/ai-usage-weekly-email.cache'
import { addUtcDays } from '@/src/lib/ai/usage-period'
import { sendAiUsageWeeklyEmail } from '@/src/lib/mail/steel-ai/send-ai-usage-weekly'
import { ok, type Result } from '@/src/lib/result'
import { toEffectiveAiSettings } from '@/src/mappers/ai-settings.mapper'
import {
  aiUsageWeekKey,
  aiUsageWeeklyDailyRange,
  aiUsageWeeklyReportWeek,
  isAiUsageWeeklyReportEmpty,
  toAiUsageWeeklyReport,
} from '@/src/mappers/ai-usage-weekly-email.mapper'
import { AiUsageAnalyticsRepository } from '@/src/repositories/ai-usage-analytics.repository'
import {
  AiUsageWeeklyEmailRepository,
  type AiUsageWeeklyWorkspace,
} from '@/src/repositories/ai-usage-weekly-email.repository'

/** Why a workspace gets no weekly e-mail. */
export type AiUsageWeeklySkipReason =
  | 'workspace_not_found'
  | 'workspace_inactive'
  | 'ai_disabled'
  | 'email_disabled'
  | 'no_usage'
  | 'no_owners'

export interface AiUsageWeeklyPlan {
  /** Monday 00:00 UTC of the reported week. */
  weekStart: Date
  weekKey: string
  /** Workspaces with spend in the reported week or the one before. */
  candidates: number
  /** Workspace ids to fan out (one job each). */
  eligible: string[]
  skipped: Partial<Record<AiUsageWeeklySkipReason, number>>
}

export interface AiUsageWeeklySendResult {
  workspaceId: string
  weekKey: string
  status: 'sent' | 'skipped'
  reason: AiUsageWeeklySkipReason | null
  /** Owners mailed by this run. */
  sent: number
  /** Owners skipped because the marker says they already got this week. */
  alreadySent: number
  /** Owners whose send failed (or whose marker could not be claimed). */
  failed: number
}

/** The workspace-level switches; `null` = eligible. */
function skipReason(
  workspace: AiUsageWeeklyWorkspace,
): AiUsageWeeklySkipReason | null {
  if (workspace.status !== 'ACTIVE') return 'workspace_inactive'
  const settings = toEffectiveAiSettings(workspace.aiSettings)
  if (!settings.aiEnabled) return 'ai_disabled'
  if (!settings.usageWeeklyEmailEnabled) return 'email_disabled'
  return null
}

function skipped(
  workspaceId: string,
  weekKey: string,
  reason: AiUsageWeeklySkipReason,
): AiUsageWeeklySendResult {
  return {
    workspaceId,
    weekKey,
    status: 'skipped',
    reason,
    sent: 0,
    alreadySent: 0,
    failed: 0,
  }
}

/**
 * Weekly Steel AI usage e-mail to the workspace OWNERs (queue
 * `ai-usage-weekly-email`, Mondays 08:00 America/Sao_Paulo). The tick plans
 * the week and fans out one job per eligible workspace; each job rebuilds
 * the numbers from the ledger with the same mappers as the "Uso" and
 * "Análises" pages and mails every owner once — a Redis marker per
 * workspace, week and owner keeps retries from sending twice.
 *
 * Eligible: workspace ACTIVE, Steel AI on (`aiEnabled`), the e-mail switch
 * on (`usageWeeklyEmailEnabled`, default on) and some spend in the reported
 * week or the one before.
 */
export const AiUsageWeeklyEmailService = {
  async planWeek(now: Date = new Date()): Promise<Result<AiUsageWeeklyPlan>> {
    const week = aiUsageWeeklyReportWeek(now)
    const weekKey = aiUsageWeekKey(week.from)
    const ids = await AiUsageWeeklyEmailRepository.listWorkspaceIdsWithUsage({
      from: addUtcDays(week.from, -7),
      to: week.to,
    })
    if (!ids.ok) return ids
    const workspaces = await AiUsageWeeklyEmailRepository.findWorkspaces(
      ids.value,
    )
    if (!workspaces.ok) return workspaces

    const eligible: string[] = []
    const skippedCounts: AiUsageWeeklyPlan['skipped'] = {}
    for (const workspace of workspaces.value) {
      const reason = skipReason(workspace)
      if (reason) {
        skippedCounts[reason] = (skippedCounts[reason] ?? 0) + 1
      } else {
        eligible.push(workspace.id)
      }
    }

    return ok({
      weekStart: week.from,
      weekKey,
      candidates: ids.value.length,
      eligible,
      skipped: skippedCounts,
    })
  },

  /**
   * Builds and sends the e-mail of one workspace for the week starting at
   * `weekStart`. Re-checks eligibility (the switches may have changed since
   * the tick). A database failure returns `err` (the job retries);
   * per-owner send failures are counted in `failed`.
   */
  async sendForWorkspace(
    workspaceId: string,
    weekStart: Date,
    now: Date = new Date(),
  ): Promise<Result<AiUsageWeeklySendResult>> {
    const weekKey = aiUsageWeekKey(weekStart)
    const found = await AiUsageWeeklyEmailRepository.findWorkspaces([
      workspaceId,
    ])
    if (!found.ok) return found
    const workspace = found.value[0]
    if (!workspace) {
      return ok(skipped(workspaceId, weekKey, 'workspace_not_found'))
    }
    const reason = skipReason(workspace)
    if (reason) return ok(skipped(workspaceId, weekKey, reason))

    const week = { from: weekStart, to: addUtcDays(weekStart, 7) }
    const [daily, groups, userGroups, agents] = await Promise.all([
      AiUsageAnalyticsRepository.dailyCosts(
        workspaceId,
        aiUsageWeeklyDailyRange(weekStart),
      ),
      AiUsageAnalyticsRepository.groupByDimensions(workspaceId, week),
      AiUsageAnalyticsRepository.groupByUser(workspaceId, week),
      AiUsageWeeklyEmailRepository.agentActivity(workspaceId, week, now),
    ])
    if (!daily.ok) return daily
    if (!groups.ok) return groups
    if (!userGroups.ok) return userGroups
    if (!agents.ok) return agents

    const userIds = userGroups.value
      .map((row) => row.userId)
      .filter((id): id is string => Boolean(id))
    const users = await AiUsageAnalyticsRepository.findUsers(userIds)
    if (!users.ok) return users

    const report = toAiUsageWeeklyReport({
      weekStart,
      daily: daily.value,
      groups: groups.value,
      userGroups: userGroups.value,
      users: users.value,
      monthlyQuotaUsd: toEffectiveAiSettings(workspace.aiSettings)
        .monthlyQuotaUsd,
      agents: agents.value,
    })
    if (isAiUsageWeeklyReportEmpty(report)) {
      return ok(skipped(workspaceId, weekKey, 'no_usage'))
    }

    const owners = await AiUsageWeeklyEmailRepository.listOwners(workspaceId)
    if (!owners.ok) return owners
    if (owners.value.length === 0) {
      return ok(skipped(workspaceId, weekKey, 'no_owners'))
    }

    const base = `${baseEmailUrl}/${workspace.slug}`
    const result: AiUsageWeeklySendResult = {
      workspaceId,
      weekKey,
      status: 'sent',
      reason: null,
      sent: 0,
      alreadySent: 0,
      failed: 0,
    }

    for (const owner of owners.value) {
      const claim = await AiUsageWeeklyEmailCache.claim(
        workspaceId,
        weekKey,
        owner.id,
      )
      if (claim === 'already_sent') {
        result.alreadySent++
        continue
      }
      if (claim === 'unavailable') {
        result.failed++
        continue
      }
      try {
        await sendAiUsageWeeklyEmail({
          email: owner.email,
          username: owner.name || undefined,
          workspaceName: workspace.name,
          report,
          usageUrl: `${base}/ai/usage`,
          analyticsUrl: `${base}/ai/analytics`,
          settingsUrl: `${base}/settings/steel-intelligence`,
        })
        result.sent++
      } catch (cause) {
        result.failed++
        await AiUsageWeeklyEmailCache.release(workspaceId, weekKey, owner.id)
        logger.error(
          'ai.usage_weekly_email.send_failed',
          logFields(
            {
              component: 'AiUsageWeeklyEmailService',
              workspaceId,
              message: cause instanceof Error ? cause.message : String(cause),
            },
            { weekKey, userId: owner.id },
          ),
        )
      }
    }

    logger.info(
      'ai.usage_weekly_email.workspace_done',
      logFields(
        { component: 'AiUsageWeeklyEmailService', workspaceId },
        {
          weekKey,
          sent: result.sent,
          alreadySent: result.alreadySent,
          failed: result.failed,
          weekUsd: report.weekUsd,
        },
      ),
    )
    return ok(result)
  },
}
