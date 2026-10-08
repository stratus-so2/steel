import type { Job } from 'bullmq'
import { auditMutation } from '@/lib/axiom/audit'
import { logFields } from '@/lib/axiom/log-fields'
import { logger } from '@/lib/axiom/logger'
import { baseEmailUrl } from '@/lib/base-email-url'
import { runApl } from '@/src/lib/analytics/axiom-query'
import { sendWorkspaceExportReadyEmail } from '@/src/lib/mail/workspace/send-workspace-export-ready'
import { prisma } from '@/src/lib/prisma'
import {
  deleteObjects,
  ensureBucket,
  listObjectKeys,
  putObject,
} from '@/src/lib/storage/s3'
import { buildDataArchive } from '@/src/lib/workspace-export/data-archive'
import {
  LOGS_MAX_ROWS,
  logRowsToCsv,
  logRowsToNdjson,
  logsReadMe,
  resolveWorkspaceLogsConfig,
  type WorkspaceLogsConfig,
  workspaceLogsApl,
} from '@/src/lib/workspace-export/logs'
import {
  EXPORT_BUCKET,
  EXPORT_KIND_LABELS,
  exportDayKey,
  exportExpiry,
  formatExportInstant,
} from '@/src/lib/workspace-export/policy'
import { createZip, type ZipEntry } from '@/src/lib/zip'
import {
  WorkspaceExportRepository,
  type WorkspaceExportWithRelations,
} from '@/src/repositories/workspace-export.repository'
import { notifyWorkspaceExportReady } from '@/src/services/platform-notifications'
import { WorkspaceExportJob, type WorkspaceExportJobPayload } from '../jobs'
import { gatherWorkspaceData } from '../workspace-snapshot'

/**
 * `workspace-export` queue. `run` builds one export requested in Ajustes ›
 * Exportações:
 *
 * - DATA — the rows of `gatherWorkspaceData` (same source of truth as the
 *   per-workspace backup) + the members' names/e-mails, one JSON and one CSV
 *   per table, secrets redacted. Only the platform database: a module
 *   pointed at an external Postgres (`WorkspaceModuleConnection`) keeps its
 *   data there and is not read here.
 * - LOGS — one APL query to Axiom for the window chosen at request time.
 *
 * Both become a ZIP in the `workspace-exports` bucket, kept 7 days; the
 * requester gets an in-app notification and an e-mail pointing to the
 * settings page (the download itself needs a session). `prune-expired`
 * (daily) deletes files past their expiry and orphans.
 */

const SIZE_UNITS = ['B', 'KB', 'MB', 'GB'] as const

export function formatFileSize(bytes: number): string {
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < SIZE_UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  return unit === 0 ? `${bytes} B` : `${value.toFixed(1)} ${SIZE_UNITS[unit]}`
}

export interface WorkspaceExportDeps {
  logsConfig?: WorkspaceLogsConfig
}

interface Built {
  entries: ZipEntry[]
  itemCount: number
}

interface WorkspaceInfo {
  id: string
  name: string
  slug: string
}

async function buildData(
  workspace: WorkspaceInfo,
  row: WorkspaceExportWithRelations,
  now: Date,
): Promise<Built> {
  const data = await gatherWorkspaceData(prisma, workspace.id)
  const { workspace: workspaceRow, ...tables } = data
  const members = await prisma.membership.findMany({
    where: { workspaceId: workspace.id },
    select: {
      role: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  })
  const archive = buildDataArchive({
    workspace,
    tables: {
      ...(tables as Record<string, unknown[]>),
      workspace: workspaceRow ? [workspaceRow] : [],
      members: members.map((m) => ({
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        memberSince: m.createdAt,
      })),
    },
    exportedAt: now,
    requestedBy: row.requestedBy
      ? { name: row.requestedBy.name, email: row.requestedBy.email }
      : null,
  })
  return { entries: archive.entries, itemCount: archive.tables.length }
}

async function buildLogs(
  workspace: WorkspaceInfo,
  row: WorkspaceExportWithRelations,
  now: Date,
  config: WorkspaceLogsConfig,
): Promise<Built> {
  if (!config.configured || !config.token) {
    throw new Error('Axiom query is not configured (AXIOM_QUERY_TOKEN)')
  }
  const from = row.periodFrom ?? new Date(now.getTime() - 7 * 86_400_000)
  const to = row.periodTo ?? now
  const result = await runApl(
    workspaceLogsApl(config.dataset, workspace.id, LOGS_MAX_ROWS),
    { from, to },
    { token: config.token, url: config.url, timeoutMs: 60_000 },
  )
  if (!result.ok) throw new Error(result.error.message)
  // Newest first from Axiom (so the cap drops the oldest); files go oldest first.
  const rows = [...result.value].reverse()
  return {
    entries: [
      {
        name: 'LEIA-ME.txt',
        data: logsReadMe({
          workspaceName: workspace.name,
          from,
          to,
          rows: rows.length,
          truncated: rows.length >= LOGS_MAX_ROWS,
        }),
      },
      { name: 'logs.csv', data: logRowsToCsv(rows) },
      { name: 'logs.ndjson', data: logRowsToNdjson(rows) },
    ],
    itemCount: rows.length,
  }
}

function isFinalAttempt(job: Job): boolean {
  return job.attemptsMade + 1 >= (job.opts?.attempts ?? 1)
}

async function notifyReady(
  row: WorkspaceExportWithRelations,
  workspace: WorkspaceInfo,
  sizeBytes: number,
  expiresAt: Date,
): Promise<void> {
  const requester = row.requestedBy
  if (!requester) return
  const kindLabel = EXPORT_KIND_LABELS[row.kind]
  await notifyWorkspaceExportReady({
    workspaceId: workspace.id,
    requestedById: requester.id,
    exportId: row.id,
    kindLabel,
  })
  try {
    await sendWorkspaceExportReadyEmail({
      email: requester.email,
      username: requester.name,
      workspaceName: workspace.name,
      kindLabel,
      pageUrl: `${baseEmailUrl}/${workspace.slug}/settings/exports`,
      expiresAt: formatExportInstant(expiresAt),
      fileSize: formatFileSize(sizeBytes),
    })
  } catch (error) {
    logger.warn(
      'queue.workspace_export.email_failed',
      logFields(
        {
          component: 'Worker',
          workspaceId: workspace.id,
          message: error instanceof Error ? error.message : String(error),
        },
        { exportId: row.id },
      ),
    )
  }
}

export interface RunResult {
  exported: boolean
  reason?: string
  sizeBytes?: number
}

export async function runWorkspaceExport(
  job: Job,
  now: Date,
  deps: WorkspaceExportDeps = {},
): Promise<RunResult> {
  const { exportId } =
    job.data as WorkspaceExportJobPayload[typeof WorkspaceExportJob.Run]
  const found = await WorkspaceExportRepository.findById(exportId)
  if (!found.ok) {
    if (found.error.code === 'WORKSPACE_EXPORT_NOT_FOUND') {
      return { exported: false, reason: 'not_found' }
    }
    throw new Error(found.error.message)
  }
  const row = found.value
  if (row.status !== 'PENDING' && row.status !== 'RUNNING') {
    return { exported: false, reason: `status_${row.status.toLowerCase()}` }
  }

  const workspaceId = row.workspaceId
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, slug: true },
    })
    if (!workspace) throw new Error(`Workspace ${workspaceId} not found`)

    const running = await WorkspaceExportRepository.markRunning(row.id)
    if (!running.ok) throw new Error(running.error.message)

    const built =
      row.kind === 'DATA'
        ? await buildData(workspace, row, now)
        : await buildLogs(
            workspace,
            row,
            now,
            deps.logsConfig ?? resolveWorkspaceLogsConfig(),
          )

    const zip = createZip(built.entries, now)
    const kindSlug = row.kind === 'DATA' ? 'dados' : 'logs'
    const fileName = `steel-${workspace.slug}-${kindSlug}-${exportDayKey(now)}.zip`
    const key = `${workspaceId}/${row.id}.zip`
    await ensureBucket(EXPORT_BUCKET)
    await putObject({
      bucket: EXPORT_BUCKET,
      key,
      body: zip,
      contentType: 'application/zip',
    })

    const expiresAt = exportExpiry(now)
    const completed = await WorkspaceExportRepository.markCompleted(row.id, {
      storageKey: key,
      fileName,
      sizeBytes: zip.length,
      itemCount: built.itemCount,
      completedAt: now,
      expiresAt,
    })
    if (!completed.ok) throw new Error(completed.error.message)

    await notifyReady(row, workspace, zip.length, expiresAt)
    auditMutation({
      entity: 'workspace_export',
      action: 'export_completed',
      actorId: 'system',
      targetId: row.id,
      meta: {
        workspaceId,
        kind: row.kind,
        sizeBytes: zip.length,
        itemCount: built.itemCount,
      },
    })
    logger.info(
      'queue.workspace_export.completed',
      logFields(
        { component: 'Worker', workspaceId },
        {
          exportId: row.id,
          kind: row.kind,
          sizeBytes: zip.length,
          itemCount: built.itemCount,
        },
      ),
    )
    return { exported: true, sizeBytes: zip.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const final = isFinalAttempt(job)
    if (final) await WorkspaceExportRepository.markFailed(row.id, message)
    logger.error(
      'queue.workspace_export.failed',
      logFields(
        { component: 'Worker', workspaceId, message },
        {
          exportId: row.id,
          kind: row.kind,
          attemptsMade: job.attemptsMade,
          final,
        },
      ),
    )
    throw error
  }
}

export interface PruneResult {
  expired: number
  orphans: number
}

export async function pruneWorkspaceExports(now: Date): Promise<PruneResult> {
  const expired = await WorkspaceExportRepository.listExpired(now)
  if (!expired.ok) throw new Error(expired.error.message)
  const keys = expired.value
    .map((row) => row.storageKey)
    .filter((key): key is string => key !== null)
  if (keys.length > 0) await deleteObjects(EXPORT_BUCKET, keys)
  const marked = await WorkspaceExportRepository.markExpired(
    expired.value.map((row) => row.id),
  )
  if (!marked.ok) throw new Error(marked.error.message)

  // Files whose row is gone (workspace deleted) or no longer points at them.
  const live = await WorkspaceExportRepository.liveStorageKeys()
  if (!live.ok) throw new Error(live.error.message)
  const stored = await listObjectKeys(EXPORT_BUCKET, '')
  const orphans = stored.filter((key) => !live.value.has(key))
  if (orphans.length > 0) await deleteObjects(EXPORT_BUCKET, orphans)

  const result = { expired: marked.value, orphans: orphans.length }
  logger.info(
    'queue.workspace_export.pruned',
    logFields({ component: 'Worker' }, { ...result }),
  )
  return result
}

/** Inner entry point with the clock injected (tests); BullMQ calls the one below. */
export async function handleWorkspaceExportJob(
  job: Job,
  now: Date,
  deps: WorkspaceExportDeps = {},
): Promise<RunResult | PruneResult> {
  switch (job.name) {
    case WorkspaceExportJob.Run:
      return runWorkspaceExport(job, now, deps)
    case WorkspaceExportJob.PruneExpired:
      return pruneWorkspaceExports(now)
    default:
      throw new Error(
        `Unknown workspace-export job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}

export async function processWorkspaceExport(
  job: Job,
): Promise<RunResult | PruneResult> {
  return handleWorkspaceExportJob(job, new Date())
}
