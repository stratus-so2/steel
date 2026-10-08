import { auditMutation } from '@/lib/axiom/audit'
import { logFields } from '@/lib/axiom/log-fields'
import { logger } from '@/lib/axiom/logger'
import { forbidden, validationError } from '@/src/errors'
import {
  addUtcDays,
  resolveAiUsagePeriod,
  type UtcRange,
  utcDayKey,
} from '@/src/lib/ai/usage-period'
import { err, ok, type Result } from '@/src/lib/result'
import { toEffectiveAiSettings } from '@/src/mappers/ai-settings.mapper'
import {
  AI_USAGE_AGGREGATE_CSV_HEADER,
  AI_USAGE_ROWS_CSV_HEADER,
  csvLine,
  overviewQueryRange,
  toAiUsageAggregateCsvRow,
  toAiUsageAnalyticsDTO,
  toAiUsageCsvRow,
  toAiUsageOverviewDTO,
} from '@/src/mappers/ai-usage-analytics.mapper'
import { WorkspaceAiSettingsRepository } from '@/src/repositories/ai-settings.repository'
import { AiUsageAnalyticsRepository } from '@/src/repositories/ai-usage-analytics.repository'
import type {
  AiUsageAnalyticsQuery,
  AiUsageExportQuery,
} from '@/src/schemas/ai-usage.schema'
import type {
  AiUsageAnalyticsDTO,
  AiUsageBreakdownItemDTO,
  AiUsageOverviewDTO,
} from '@/types/ai-usage'
import { assertMember, type MembershipContext } from './authz'

/** Ledger rows fetched per round trip by the CSV export. */
export const AI_USAGE_EXPORT_PAGE_SIZE = 1000

const BYTE_ORDER_MARK = '﻿'

export interface AiUsageCsvExport {
  filename: string
  /**
   * CSV chunks (BOM + header first). Built lazily so the route can stream
   * them; a database failure while paging is logged and rethrown so the
   * stream aborts instead of delivering a truncated file.
   */
  chunks: AsyncGenerator<string>
}

/** Personal = the actor's own rows; workspace = everything (OWNER/ADMIN). */
async function authorizeScope(
  actorId: string,
  workspaceId: string,
  scope: AiUsageAnalyticsQuery['scope'],
): Promise<Result<MembershipContext>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership
  if (scope === 'workspace' && !membership.value.isPrivileged) {
    return err(
      forbidden(
        'Só o dono e os administradores veem o consumo de todo o espaço de trabalho',
      ),
    )
  }
  return membership
}

async function buildAnalytics(
  actorId: string,
  workspaceId: string,
  query: AiUsageAnalyticsQuery,
  range: UtcRange,
  canViewWorkspace: boolean,
): Promise<Result<AiUsageAnalyticsDTO>> {
  const userId = query.scope === 'personal' ? actorId : undefined
  const [groups, userGroups, daily] = await Promise.all([
    AiUsageAnalyticsRepository.groupByDimensions(workspaceId, range, userId),
    query.scope === 'workspace'
      ? AiUsageAnalyticsRepository.groupByUser(workspaceId, range)
      : Promise.resolve(ok(null)),
    AiUsageAnalyticsRepository.dailyCosts(workspaceId, range, userId),
  ])
  if (!groups.ok) return groups
  if (!userGroups.ok) return userGroups
  if (!daily.ok) return daily

  const userIds = (userGroups.value ?? [])
    .map((row) => row.userId)
    .filter((id): id is string => Boolean(id))
  const users = await AiUsageAnalyticsRepository.findUsers(userIds)
  if (!users.ok) return users

  return ok(
    toAiUsageAnalyticsDTO({
      scope: query.scope,
      period: query.period,
      range,
      groups: groups.value,
      userGroups: userGroups.value,
      users: users.value,
      daily: daily.value,
      canViewWorkspace,
    }),
  )
}

async function* rowChunks(
  workspaceId: string,
  range: UtcRange,
  userId: string | undefined,
): AsyncGenerator<string> {
  yield BYTE_ORDER_MARK + csvLine(AI_USAGE_ROWS_CSV_HEADER)
  let cursor: string | undefined
  for (;;) {
    const page = await AiUsageAnalyticsRepository.exportPage(
      workspaceId,
      range,
      { userId, cursor, take: AI_USAGE_EXPORT_PAGE_SIZE },
    )
    if (!page.ok) {
      logger.error(
        'ai.usage_export_failed',
        logFields(
          {
            component: 'AiUsageAnalyticsService',
            workspaceId,
            message: page.error.message,
          },
          { cursor: cursor ?? null },
        ),
      )
      throw new Error(page.error.message)
    }
    if (page.value.length === 0) return
    yield page.value.map(toAiUsageCsvRow).join('')
    if (page.value.length < AI_USAGE_EXPORT_PAGE_SIZE) return
    cursor = page.value[page.value.length - 1].id
  }
}

async function* aggregateChunks(
  items: AiUsageBreakdownItemDTO[],
): AsyncGenerator<string> {
  yield BYTE_ORDER_MARK + csvLine(AI_USAGE_AGGREGATE_CSV_HEADER)
  if (items.length > 0) yield items.map(toAiUsageAggregateCsvRow).join('')
}

const BREAKDOWN_BY_VIEW = {
  model: 'byModel',
  feature: 'byFeature',
  module: 'byModule',
} as const

/**
 * Steel AI usage pages: "Uso" (personal overview with the quota) and
 * "Análises" (breakdowns + CSV). Money is the real cost frozen in the
 * ledger (US$, ADR 0019); days, weeks and months are UTC like the quota.
 */
export const AiUsageAnalyticsService = {
  /** Any member: their own spend vs the workspace quota, month and week. */
  async overview(
    actorId: string,
    workspaceId: string,
    now: Date = new Date(),
  ): Promise<Result<AiUsageOverviewDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const [settings, daily] = await Promise.all([
      WorkspaceAiSettingsRepository.findByWorkspace(workspaceId),
      AiUsageAnalyticsRepository.dailyCosts(
        workspaceId,
        overviewQueryRange(now),
        actorId,
      ),
    ])
    if (!settings.ok) return settings
    if (!daily.ok) return daily

    return ok(
      toAiUsageOverviewDTO({
        daily: daily.value,
        monthlyQuotaUsd: toEffectiveAiSettings(settings.value).monthlyQuotaUsd,
        canViewWorkspace: membership.value.isPrivileged,
        now,
      }),
    )
  },

  /** Breakdowns of a period; the workspace scope is OWNER/ADMIN only. */
  async analytics(
    actorId: string,
    workspaceId: string,
    query: AiUsageAnalyticsQuery,
    now: Date = new Date(),
  ): Promise<Result<AiUsageAnalyticsDTO>> {
    const membership = await authorizeScope(actorId, workspaceId, query.scope)
    if (!membership.ok) return membership
    return buildAnalytics(
      actorId,
      workspaceId,
      query,
      resolveAiUsagePeriod(query, now),
      membership.value.isPrivileged,
    )
  },

  /**
   * CSV of a period: raw rows (streamed page by page) or one aggregated
   * breakdown. Audited — the workspace export carries other members' names
   * and e-mails.
   */
  async exportCsv(
    actorId: string,
    workspaceId: string,
    query: AiUsageExportQuery,
    now: Date = new Date(),
  ): Promise<Result<AiUsageCsvExport>> {
    if (query.view === 'user' && query.scope !== 'workspace') {
      return err(
        validationError(
          'O consumo por usuário só existe na visão do espaço de trabalho',
        ),
      )
    }
    const membership = await authorizeScope(actorId, workspaceId, query.scope)
    if (!membership.ok) return membership

    const range = resolveAiUsagePeriod(query, now)
    const filename = `steel-ai-uso-${query.scope === 'personal' ? 'pessoal' : 'workspace'}-${query.view}-${utcDayKey(range.from)}_${utcDayKey(addUtcDays(range.to, -1))}.csv`

    let chunks: AsyncGenerator<string>
    if (query.view === 'rows') {
      chunks = rowChunks(
        workspaceId,
        range,
        query.scope === 'personal' ? actorId : undefined,
      )
    } else {
      const analytics = await buildAnalytics(
        actorId,
        workspaceId,
        query,
        range,
        membership.value.isPrivileged,
      )
      if (!analytics.ok) return analytics
      // `byUser` is never null here: the user view requires the workspace scope.
      chunks = aggregateChunks(
        query.view === 'user'
          ? (analytics.value.byUser as AiUsageBreakdownItemDTO[])
          : analytics.value[BREAKDOWN_BY_VIEW[query.view]],
      )
    }

    auditMutation({
      entity: 'ai_usage',
      action: 'download',
      actorId,
      targetId: workspaceId,
      meta: {
        scope: query.scope,
        view: query.view,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
    })

    return ok({ filename, chunks })
  },
}
