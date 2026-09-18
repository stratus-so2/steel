import { logger } from '@/lib/axiom/logger'
import {
  bucketChurnByMonth,
  computeMrr,
  summarizeUsage,
} from '@/src/lib/metrics'
import { ok, type Result } from '@/src/lib/result'
import { recentUsageDays } from '@/src/lib/usage/module-usage'
import { AdminMetricsRepository } from '@/src/repositories/admin-metrics.repository'
import { ModuleUsageRepository } from '@/src/repositories/module-usage.repository'
import type { AdminMetricsDTO } from '@/types/admin-metrics'
import { assertPlatformAdmin } from './authz'

export const METRICS_WINDOW_DAYS = 30
const CHURN_MONTHS = 12

export const AdminMetricsService = {
  /** Visão geral da plataforma para o painel admin global. */
  async getOverview(
    actorId: string,
    now: Date = new Date(),
  ): Promise<Result<AdminMetricsDTO>> {
    const admin = await assertPlatformAdmin(actorId)
    if (!admin.ok) return admin

    const sinceDay = recentUsageDays(now, METRICS_WINDOW_DAYS)[0]
    const loginSince = new Date(
      now.getTime() - METRICS_WINDOW_DAYS * 86_400_000,
    )
    // Margem sobre 12 meses: o bucket descarta o que ficar fora da janela.
    const churnSince = new Date(now.getTime() - 400 * 86_400_000)

    const [totalWorkspaces, withLogin, paying, ended, usageRows, firstDay] =
      await Promise.all([
        AdminMetricsRepository.countWorkspaces(),
        AdminMetricsRepository.countWorkspacesWithLoginSince(loginSince),
        AdminMetricsRepository.listPayingSubscriptions(),
        AdminMetricsRepository.listEndedSubscriptionsSince(churnSince),
        ModuleUsageRepository.listSince(sinceDay),
        ModuleUsageRepository.firstDay(),
      ])
    if (!totalWorkspaces.ok) return totalWorkspaces
    if (!withLogin.ok) return withLogin
    if (!paying.ok) return paying
    if (!ended.ok) return ended
    if (!usageRows.ok) return usageRows
    if (!firstDay.ok) return firstDay

    const usage = summarizeUsage(usageRows.value)

    logger.info('admin_metrics.overview_built', {
      actorId,
      usageRows: usageRows.value.length,
      activeClients: usage.activeWorkspaces,
    })

    return ok({
      generatedAt: now.toISOString(),
      windowDays: METRICS_WINDOW_DAYS,
      totalWorkspaces: totalWorkspaces.value,
      activeClients: usage.activeWorkspaces,
      workspacesWithLogin: withLogin.value,
      mrr: computeMrr(paying.value),
      churnByMonth: bucketChurnByMonth(ended.value, now, CHURN_MONTHS),
      usage: {
        totals: usage.totals,
        daily: usage.daily,
        topWorkspaces: usage.topWorkspaces,
        trackedSince: firstDay.value,
      },
    })
  },
}
