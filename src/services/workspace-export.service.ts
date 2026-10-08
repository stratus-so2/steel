import type { WorkspaceExportKind } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { logFields } from '@/lib/axiom/log-fields'
import { logger } from '@/lib/axiom/logger'
import {
  workspaceExportLimitReached,
  workspaceExportLogsUnavailable,
  workspaceExportNotReady,
} from '@/src/errors'
import { enqueueWorkspaceExport } from '@/src/lib/queue/workspace-export'
import { err, ok, type Result } from '@/src/lib/result'
import {
  LOGS_PERIOD_DAYS,
  resolveWorkspaceLogsConfig,
  type WorkspaceLogsConfig,
} from '@/src/lib/workspace-export/logs'
import {
  EXPORT_BUCKET,
  EXPORT_KIND_LABELS,
  EXPORT_RETENTION_DAYS,
  exportDayKey,
  formatExportInstant,
  nextExportSlot,
} from '@/src/lib/workspace-export/policy'
import {
  isWorkspaceExportDownloadable,
  toWorkspaceExportDTO,
} from '@/src/mappers/workspace-export.mapper'
import {
  DAILY_SLOT_TAKEN,
  WorkspaceExportRepository,
} from '@/src/repositories/workspace-export.repository'
import type { CreateWorkspaceExportDTO } from '@/src/schemas/workspace-export.schema'
import type {
  WorkspaceExportDTO,
  WorkspaceExportOverviewDTO,
} from '@/types/workspace-export'
import { assertPrivileged } from './authz'

/**
 * Ajustes › Exportações (OWNER/ADMIN). Each kind — complete data or Axiom
 * logs — once per workspace per São Paulo day; a failed export frees the
 * slot. The file is built by the `workspace-export` worker queue, stays in
 * MinIO for 7 days and is downloaded through an authenticated route.
 */

const KINDS: WorkspaceExportKind[] = ['DATA', 'LOGS']

const DAY_MS = 24 * 60 * 60 * 1000

interface Deps {
  now?: Date
  logsConfig?: WorkspaceLogsConfig
}

export interface WorkspaceExportDownload {
  bucket: string
  key: string
  fileName: string
  sizeBytes: number | null
}

function limitMessage(kind: WorkspaceExportKind, next: Date): string {
  return `A exportação de ${EXPORT_KIND_LABELS[kind]} já foi feita hoje. Ela fica disponível de novo em ${formatExportInstant(next)} (horário de Brasília).`
}

export const WorkspaceExportService = {
  async overview(
    actorId: string,
    workspaceId: string,
    deps: Deps = {},
  ): Promise<Result<WorkspaceExportOverviewDTO>> {
    const now = deps.now ?? new Date()
    const logs = deps.logsConfig ?? resolveWorkspaceLogsConfig()
    const membership = await assertPrivileged(actorId, workspaceId)
    if (!membership.ok) return membership

    const [rows, taken] = await Promise.all([
      WorkspaceExportRepository.listByWorkspace(workspaceId),
      WorkspaceExportRepository.takenKinds(workspaceId, exportDayKey(now)),
    ])
    if (!rows.ok) return rows
    if (!taken.ok) return taken

    const next = nextExportSlot(now).toISOString()
    return ok({
      items: rows.value.map((row) => toWorkspaceExportDTO(row, now)),
      availability: KINDS.map((kind) => {
        const used = taken.value.includes(kind)
        return {
          kind,
          available: !used,
          nextAvailableAt: used ? next : null,
          configured: kind === 'DATA' || logs.configured,
        }
      }),
      retentionDays: EXPORT_RETENTION_DAYS,
      logsPeriodDays: [...LOGS_PERIOD_DAYS],
    })
  },

  async request(
    actorId: string,
    workspaceId: string,
    input: CreateWorkspaceExportDTO,
    deps: Deps = {},
  ): Promise<Result<WorkspaceExportDTO>> {
    const now = deps.now ?? new Date()
    const logs = deps.logsConfig ?? resolveWorkspaceLogsConfig()
    const membership = await assertPrivileged(actorId, workspaceId)
    if (!membership.ok) return membership

    if (input.kind === 'LOGS' && !logs.configured) {
      return err(workspaceExportLogsUnavailable())
    }

    const created = await WorkspaceExportRepository.create({
      workspaceId,
      kind: input.kind,
      requestedById: actorId,
      dayKey: exportDayKey(now),
      ...(input.kind === 'LOGS'
        ? {
            periodFrom: new Date(now.getTime() - input.periodDays * DAY_MS),
            periodTo: now,
          }
        : {}),
    })
    if (!created.ok) return created
    if (created.value === DAILY_SLOT_TAKEN) {
      const next = nextExportSlot(now)
      return err(
        workspaceExportLimitReached(limitMessage(input.kind, next), next),
      )
    }
    const row = created.value

    try {
      await enqueueWorkspaceExport(row.id)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await WorkspaceExportRepository.markFailed(row.id, message)
      logger.error(
        'workspace_export.enqueue_failed',
        logFields(
          { component: 'WorkspaceExport', workspaceId, message },
          {
            exportId: row.id,
          },
        ),
      )
      return err(
        workspaceExportNotReady(
          'Não foi possível iniciar a exportação agora. Tente de novo em instantes.',
        ),
      )
    }

    auditMutation({
      entity: 'workspace_export',
      action: 'export_requested',
      actorId,
      targetId: row.id,
      meta: {
        workspaceId,
        kind: input.kind,
        ...(input.kind === 'LOGS' ? { periodDays: input.periodDays } : {}),
      },
    })
    logger.info(
      'workspace_export.requested',
      logFields(
        { component: 'WorkspaceExport', workspaceId },
        {
          exportId: row.id,
          kind: input.kind,
        },
      ),
    )
    return ok(toWorkspaceExportDTO(row, now))
  },

  /** Checks access and expiry; audits the download. */
  async authorizeDownload(
    actorId: string,
    workspaceId: string,
    exportId: string,
    deps: Deps = {},
  ): Promise<Result<WorkspaceExportDownload>> {
    const now = deps.now ?? new Date()
    const membership = await assertPrivileged(actorId, workspaceId)
    if (!membership.ok) return membership

    const row = await WorkspaceExportRepository.findById(exportId, workspaceId)
    if (!row.ok) return row
    if (!isWorkspaceExportDownloadable(row.value, now)) {
      return err(
        workspaceExportNotReady(
          row.value.status === 'COMPLETED' || row.value.status === 'EXPIRED'
            ? 'O arquivo desta exportação expirou. Gere uma nova exportação.'
            : undefined,
        ),
      )
    }

    auditMutation({
      entity: 'workspace_export',
      action: 'download',
      actorId,
      targetId: exportId,
      meta: { workspaceId, kind: row.value.kind },
    })
    return ok({
      bucket: EXPORT_BUCKET,
      key: row.value.storageKey as string,
      fileName: row.value.fileName ?? `${exportId}.zip`,
      sizeBytes:
        row.value.sizeBytes === null ? null : Number(row.value.sizeBytes),
    })
  },
}
