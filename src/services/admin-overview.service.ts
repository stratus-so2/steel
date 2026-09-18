import { logger } from '@/lib/axiom/logger'
import { computeMrr } from '@/src/lib/metrics'
import { getQueueHealth } from '@/src/lib/queue/health'
import { ok, type Result } from '@/src/lib/result'
import {
  toAdminAuditEntryDTO,
  toAdminOperationDTO,
} from '@/src/mappers/admin-workspace.mapper'
import { AdminAuditLogRepository } from '@/src/repositories/admin-audit-log.repository'
import { AdminMetricsRepository } from '@/src/repositories/admin-metrics.repository'
import { AdminOperationRepository } from '@/src/repositories/admin-operation.repository'
import { AdminOverviewRepository } from '@/src/repositories/admin-overview.repository'
import { StatusRepository } from '@/src/repositories/status.repository'
import type { AdminOverviewDTO, QueueHealthDTO } from '@/types/admin-workspace'
import { listBackupDTOs } from './admin-backup.service'
import { assertPlatformAdmin } from './authz'
import {
  COMPONENTS,
  COMPONENTS_BY_KEY,
  type ComponentKey,
} from './status/components'

async function safeQueueHealth(): Promise<QueueHealthDTO[] | null> {
  try {
    return await getQueueHealth()
  } catch (error) {
    logger.warn('admin.overview.queue_health_unavailable', {
      message: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * Visão geral da plataforma (`/admin`): uma tela com totais, MRR, cadastros
 * e ações recentes, saúde das filas e do status page, últimos backups.
 * Tudo em paralelo; as filas têm cache/timeout próprios e degradam para
 * `null` sem derrubar a página.
 */
export const AdminOverviewService = {
  async get(
    actorId: string,
    now: Date = new Date(),
  ): Promise<Result<AdminOverviewDTO>> {
    const admin = await assertPlatformAdmin(actorId)
    if (!admin.ok) return admin

    const [
      workspaces,
      users,
      paying,
      signups,
      actions,
      queues,
      health,
      backups,
      operations,
    ] = await Promise.all([
      AdminOverviewRepository.workspaceCounts(now),
      AdminOverviewRepository.userCounts(now),
      AdminMetricsRepository.listPayingSubscriptions(),
      AdminOverviewRepository.recentSignups(8),
      AdminAuditLogRepository.listRecent(10),
      safeQueueHealth(),
      StatusRepository.findLatestPerComponent(),
      listBackupDTOs({ limit: 6 }),
      AdminOperationRepository.listRecent({ limit: 5 }),
    ])
    if (!workspaces.ok) return workspaces
    if (!users.ok) return users
    if (!paying.ok) return paying
    if (!signups.ok) return signups
    if (!actions.ok) return actions
    if (!health.ok) return health
    if (!backups.ok) return backups
    if (!operations.ok) return operations

    const known = new Set<string>(COMPONENTS.map((c) => c.key))
    const status = health.value
      .filter((row) => known.has(row.componentKey))
      .map((row) => ({
        componentKey: row.componentKey,
        name: COMPONENTS_BY_KEY[row.componentKey as ComponentKey].name,
        status: row.status,
        latencyMs: row.latencyMs,
        checkedAt: new Date(row.checkedAt).toISOString(),
      }))

    return ok({
      generatedAt: now.toISOString(),
      workspaces: workspaces.value,
      users: users.value,
      mrr: computeMrr(paying.value),
      recentSignups: signups.value,
      recentActions: actions.value.map(toAdminAuditEntryDTO),
      queues,
      status,
      recentBackups: backups.value,
      operations: operations.value.map(toAdminOperationDTO),
    })
  },
}
