import type { AdminOperation, Prisma } from '@prisma/client'
import type { Job } from 'bullmq'
import { logger } from '@/lib/axiom/logger'
import { WorkspaceCache } from '@/src/cache/workspace.cache'
import { WorkspaceFeaturesCache } from '@/src/cache/workspace-features.cache'
import { recordAdminAction } from '@/src/lib/admin-audit'
import { prisma } from '@/src/lib/prisma'
import { purgeWorkspaceFiles } from '@/src/lib/storage/workspace-files'
import { fetchAndDecryptBackup } from '../database-restore'
import type { DatabaseBackupJob, DatabaseBackupJobPayload } from '../jobs'
import {
  purgeWorkspaceRows,
  restoreWorkspaceSnapshot,
  type WorkspaceSnapshot,
} from '../workspace-snapshot'
import { backupWorkspace } from './database-backup'

type Meta = Record<string, unknown>

function metaOf(operation: AdminOperation): Meta {
  return (operation.meta as Meta | null) ?? {}
}

async function setStep(
  id: string,
  step: string,
  data: Omit<Prisma.AdminOperationUpdateInput, 'step'> = {},
): Promise<void> {
  await prisma.adminOperation.update({
    where: { id },
    data: { status: 'RUNNING', step, ...data },
  })
}

async function invalidateWorkspaceCaches(workspaceId: string): Promise<void> {
  await Promise.all([
    WorkspaceCache.invalidate(workspaceId),
    WorkspaceFeaturesCache.invalidate(workspaceId),
  ]).catch(() => undefined)
}

/**
 * Carrega a operação e decide se roda. Operação já concluída/falhada não é
 * reprocessada (o job tem `attempts: 1`; isto cobre um re-enqueue manual).
 */
async function loadRunnable(
  operationId: string,
  jobId: string | undefined,
): Promise<AdminOperation | null> {
  const operation = await prisma.adminOperation.findUnique({
    where: { id: operationId },
  })
  if (!operation || operation.status === 'COMPLETED') {
    logger.warn('queue.admin_operation.skipped', {
      component: 'Worker',
      jobId,
      operationId,
      reason: operation ? 'already_completed' : 'not_found',
    })
    return null
  }
  if (operation.status === 'FAILED') {
    logger.warn('queue.admin_operation.skipped', {
      component: 'Worker',
      jobId,
      operationId,
      reason: 'already_failed',
    })
    return null
  }
  return operation
}

const actorOf = (operation: AdminOperation) => ({
  userId: operation.requestedById,
  email: operation.requestedByEmail,
})

/**
 * Exclusão definitiva de um workspace, em cadeia: backup do workspace (o
 * mesmo passo do job `run-workspace-backup`) → só com o backup COMPLETED,
 * apaga as linhas (transação) → apaga os arquivos no MinIO. Falha antes do
 * purge do banco devolve o workspace ao status anterior; nada é apagado.
 */
export async function runWorkspaceDeletion(
  job: Job<DatabaseBackupJobPayload[typeof DatabaseBackupJob.DeleteWorkspace]>,
): Promise<{ backupId: string; filesDeleted: number } | undefined> {
  const operation = await loadRunnable(job.data.operationId, job.id)
  if (!operation) return undefined

  const { id, workspaceId } = operation
  const meta = metaOf(operation)
  let databasePurged = false

  try {
    // 1. Backup — reaproveita um backup já concluído desta operação.
    await setStep(id, 'backup')
    let backupId = operation.backupId
    const existing = backupId
      ? await prisma.backup.findUnique({ where: { id: backupId } })
      : null
    if (!existing || existing.status !== 'COMPLETED') {
      const backup = await backupWorkspace({
        workspaceId,
        triggeredById: operation.requestedById,
        jobId: job.id,
      })
      backupId = backup.backupId
    }
    if (!backupId) throw new Error('Backup do workspace não foi gerado.')

    // 2. Banco — coleta o que depende das linhas antes de apagá-las.
    await setStep(id, 'purge_database', { backupId })
    const [aiAttachments, subscriptions] = await Promise.all([
      prisma.crmAiAttachment.findMany({
        where: { conversation: { workspaceId } },
        select: { storageKey: true },
      }),
      prisma.subscription.findMany({
        where: { workspaceId, status: { in: ['PAID', 'PENDING'] } },
        select: { billId: true, plan: true, status: true, interval: true },
      }),
    ])

    await prisma.$transaction((tx) => purgeWorkspaceRows(tx, workspaceId), {
      timeout: 120_000,
    })
    databasePurged = true
    await invalidateWorkspaceCaches(workspaceId)

    // 3. Arquivos — falha aqui não desfaz o purge (já sem volta); fica
    // registrada para limpeza manual.
    await setStep(id, 'purge_files')
    let filesDeleted = 0
    let filesError: string | null = null
    try {
      const files = await purgeWorkspaceFiles(
        workspaceId,
        aiAttachments.map((a) => a.storageKey),
      )
      filesDeleted = files.deleted
    } catch (error) {
      filesError = error instanceof Error ? error.message : String(error)
      logger.error('queue.admin_operation.files_purge_failed', {
        component: 'Worker',
        operationId: id,
        workspaceId,
        message: filesError,
      })
    }

    // Não há API de cancelamento no cliente AbacatePay: a lista fica na
    // operação para o admin cancelar no painel do provedor.
    const subscriptionsToCancel = subscriptions.filter(
      (s) => s.status === 'PAID',
    )

    await prisma.adminOperation.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        step: 'done',
        completedAt: new Date(),
        meta: {
          ...meta,
          filesDeleted,
          filesError,
          subscriptionsToCancel,
        } as Prisma.InputJsonValue,
      },
    })

    await recordAdminAction({
      actor: actorOf(operation),
      action: 'workspace.deleted',
      audit: { entity: 'workspace', action: 'delete' },
      targetType: 'workspace',
      targetId: workspaceId,
      targetLabel: operation.workspaceSlug,
      reason: operation.reason,
      meta: {
        operationId: id,
        backupId,
        filesDeleted,
        filesError,
        subscriptionsToCancel: subscriptionsToCancel.map((s) => s.billId),
      },
    })

    logger.info('queue.admin_operation.workspace_deleted', {
      component: 'Worker',
      jobId: job.id,
      operationId: id,
      workspaceId,
      backupId,
      filesDeleted,
    })
    return { backupId, filesDeleted }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await prisma.adminOperation.update({
      where: { id },
      data: { status: 'FAILED', error: message, completedAt: new Date() },
    })
    if (!databasePurged) {
      // Nada foi apagado: devolve o workspace ao status de antes do pedido.
      const previous =
        meta.previousStatus === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE'
      await prisma.workspace.updateMany({
        where: { id: workspaceId, status: 'DELETING' },
        data: { status: previous },
      })
      await invalidateWorkspaceCaches(workspaceId)
    }
    await recordAdminAction({
      actor: actorOf(operation),
      action: 'workspace.delete_failed',
      audit: { entity: 'workspace', action: 'delete' },
      outcome: 'failure',
      targetType: 'workspace',
      targetId: workspaceId,
      targetLabel: operation.workspaceSlug,
      reason: operation.reason,
      meta: { operationId: id, error: message, databasePurged },
    })
    logger.error('queue.admin_operation.workspace_delete_failed', {
      component: 'Worker',
      jobId: job.id,
      operationId: id,
      workspaceId,
      databasePurged,
      message,
    })
    throw error
  }
}

/**
 * Restaura um workspace a partir de um backup WORKSPACE. Se o workspace
 * existe hoje, tira antes um backup de segurança do estado atual (o restore
 * substitui tudo) — o id fica em `meta.safetyBackupId` para desfazer.
 */
export async function runWorkspaceRestore(
  job: Job<DatabaseBackupJobPayload[typeof DatabaseBackupJob.RestoreWorkspace]>,
): Promise<{ tables: number; rows: number } | undefined> {
  const operation = await loadRunnable(job.data.operationId, job.id)
  if (!operation) return undefined

  const { id, workspaceId } = operation
  const meta = metaOf(operation)

  try {
    if (!operation.backupId) throw new Error('Operação sem backup de origem.')

    const current = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    })
    let safetyBackupId: string | null = null
    if (current) {
      await setStep(id, 'safety_backup')
      const safety = await backupWorkspace({
        workspaceId,
        triggeredById: operation.requestedById,
        jobId: job.id,
      })
      safetyBackupId = safety.backupId
    }

    await setStep(id, 'restore', {
      meta: { ...meta, safetyBackupId } as Prisma.InputJsonValue,
    })
    const { buffer, backup } = await fetchAndDecryptBackup(operation.backupId)
    if (backup.scope !== 'WORKSPACE') {
      throw new Error(`Backup "${backup.id}" não é de workspace.`)
    }
    const snapshot = JSON.parse(buffer.toString('utf-8')) as WorkspaceSnapshot
    if (snapshot.workspaceId !== workspaceId) {
      throw new Error('O backup pertence a outro workspace.')
    }

    const result = await restoreWorkspaceSnapshot(prisma, snapshot)
    await invalidateWorkspaceCaches(workspaceId)

    await prisma.adminOperation.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        step: 'done',
        completedAt: new Date(),
        meta: { ...meta, safetyBackupId, ...result } as Prisma.InputJsonValue,
      },
    })

    await recordAdminAction({
      actor: actorOf(operation),
      action: 'workspace.restored',
      audit: { entity: 'workspace', action: 'restore' },
      targetType: 'workspace',
      targetId: workspaceId,
      targetLabel: operation.workspaceSlug,
      reason: operation.reason,
      meta: { operationId: id, backupId: operation.backupId, safetyBackupId },
    })

    logger.info('queue.admin_operation.workspace_restored', {
      component: 'Worker',
      jobId: job.id,
      operationId: id,
      workspaceId,
      backupId: operation.backupId,
      ...result,
    })
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await prisma.adminOperation.update({
      where: { id },
      data: { status: 'FAILED', error: message, completedAt: new Date() },
    })
    await recordAdminAction({
      actor: actorOf(operation),
      action: 'workspace.restore_failed',
      audit: { entity: 'workspace', action: 'restore' },
      outcome: 'failure',
      targetType: 'workspace',
      targetId: workspaceId,
      targetLabel: operation.workspaceSlug,
      reason: operation.reason,
      meta: { operationId: id, error: message },
    })
    logger.error('queue.admin_operation.workspace_restore_failed', {
      component: 'Worker',
      jobId: job.id,
      operationId: id,
      workspaceId,
      message,
    })
    throw error
  }
}
