import { logger } from '@/lib/axiom/logger'
import {
  backupDownloadLinkInvalid,
  backupNotFound,
  backupNotRestorable,
  conflict,
  notFound,
  workspaceConfirmationMismatch,
  workspaceOperationInProgress,
  workspaceStatusConflict,
} from '@/src/errors'
import { appError } from '@/src/errors/app-error'
import { recordAdminAction } from '@/src/lib/admin-audit'
import {
  createBackupDownloadToken,
  verifyBackupDownloadToken,
} from '@/src/lib/backup-download-token'
import { BACKUP_BUCKET } from '@/src/lib/queue/backup-bucket'
import {
  enqueueAdminOperation,
  triggerFullBackup,
  triggerWorkspaceBackup,
} from '@/src/lib/queue/database-backup'
import { err, ok, type Result } from '@/src/lib/result'
import { getOffsiteConfig } from '@/src/lib/storage/offsite-backup'
import {
  toAdminBackupDTO,
  toAdminOperationDTO,
} from '@/src/mappers/admin-workspace.mapper'
import { AdminOperationRepository } from '@/src/repositories/admin-operation.repository'
import { BackupRepository } from '@/src/repositories/backup.repository'
import { WorkspaceRepository } from '@/src/repositories/workspace.repository'
import type {
  ConfirmedWorkspaceActionInput,
  ListBackupsQuery,
  TriggerBackupInput,
} from '@/src/schemas/admin.schema'
import type {
  AdminBackupDownloadLinkDTO,
  AdminBackupDTO,
  AdminBackupListDTO,
  AdminOperationDTO,
} from '@/types/admin-workspace'
import { assertPlatformAdmin } from './authz'

export interface BackupDownloadTarget {
  bucket: string
  key: string
  filename: string
}

/** Lista backups e marca quais workspaces ainda existem. */
export async function listBackupDTOs(
  query: Omit<ListBackupsQuery, 'limit'> & { limit: number },
): Promise<Result<AdminBackupDTO[]>> {
  const backups = await BackupRepository.list(query)
  if (!backups.ok) return backups

  const ids = [
    ...new Set(
      backups.value
        .map((b) => b.workspaceId)
        .filter((id): id is string => id !== null),
    ),
  ]
  const existing = await BackupRepository.existingWorkspaceIds(ids)
  if (!existing.ok) return existing

  return ok(backups.value.map((b) => toAdminBackupDTO(b, existing.value)))
}

function queueUnavailable() {
  return appError(
    'INTERNAL_SERVER_ERROR',
    'Fila de backups indisponível. Tente novamente em instantes.',
  )
}

/**
 * Backups pelo painel admin: listar, disparar (FULL ou por workspace),
 * baixar por link assinado e restaurar um workspace (job com backup de
 * segurança antes). Tudo auditado.
 */
export const AdminBackupService = {
  async list(
    actorId: string,
    query: ListBackupsQuery,
  ): Promise<Result<AdminBackupListDTO>> {
    const admin = await assertPlatformAdmin(actorId)
    if (!admin.ok) return admin

    const backups = await listBackupDTOs(query)
    if (!backups.ok) return backups
    return ok({
      backups: backups.value,
      offsiteConfigured: getOffsiteConfig() !== null,
    })
  },

  async trigger(
    actorId: string,
    input: TriggerBackupInput,
  ): Promise<Result<{ jobId: string }>> {
    const admin = await assertPlatformAdmin(actorId)
    if (!admin.ok) return admin

    let label: string | null = null
    if (input.scope === 'WORKSPACE') {
      const workspace = await WorkspaceRepository.findById(input.workspaceId)
      if (!workspace.ok) return workspace
      if (workspace.value.status === 'DELETING') {
        return err(workspaceStatusConflict('O workspace está sendo excluído'))
      }
      label = workspace.value.slug
    }

    let jobId: string
    try {
      jobId =
        input.scope === 'FULL'
          ? await triggerFullBackup(admin.value.userId)
          : await triggerWorkspaceBackup(input.workspaceId, admin.value.userId)
    } catch (error) {
      logger.error('admin.backup.trigger_failed', {
        actorId,
        scope: input.scope,
        message: error instanceof Error ? error.message : String(error),
      })
      return err(queueUnavailable())
    }

    await recordAdminAction({
      actor: admin.value,
      action:
        input.scope === 'FULL'
          ? 'backup.full_requested'
          : 'backup.workspace_requested',
      audit: { entity: 'backup', action: 'create' },
      targetType: input.scope === 'FULL' ? 'platform' : 'workspace',
      targetId: input.scope === 'FULL' ? null : input.workspaceId,
      targetLabel: label,
      meta: { jobId },
    })
    return ok({ jobId })
  },

  async createDownloadLink(
    actorId: string,
    backupId: string,
  ): Promise<Result<AdminBackupDownloadLinkDTO>> {
    const admin = await assertPlatformAdmin(actorId)
    if (!admin.ok) return admin

    const backup = await BackupRepository.findById(backupId)
    if (!backup.ok) return backup
    if (!backup.value) return err(backupNotFound())
    if (backup.value.status !== 'COMPLETED' || !backup.value.storageKey) {
      return err(backupNotRestorable('O backup não foi concluído'))
    }

    const { exp, sig } = createBackupDownloadToken(backupId, admin.value.userId)
    await recordAdminAction({
      actor: admin.value,
      action: 'backup.download_link',
      audit: { entity: 'backup', action: 'download' },
      targetType: 'backup',
      targetId: backupId,
      targetLabel: backup.value.workspaceSlug ?? backup.value.scope,
      meta: { expiresAt: new Date(exp * 1000).toISOString() },
    })

    return ok({
      url: `/api/admin/backups/${backupId}/download?exp=${exp}&sig=${sig}`,
      expiresAt: new Date(exp * 1000).toISOString(),
    })
  },

  /** Valida sessão de admin + assinatura e devolve o objeto a transmitir. */
  async authorizeDownload(
    actorId: string,
    backupId: string,
    token: { exp: number; sig: string },
  ): Promise<Result<BackupDownloadTarget>> {
    const admin = await assertPlatformAdmin(actorId)
    if (!admin.ok) return admin

    if (
      !verifyBackupDownloadToken({
        backupId,
        actorId: admin.value.userId,
        ...token,
      })
    ) {
      return err(backupDownloadLinkInvalid())
    }

    const backup = await BackupRepository.findById(backupId)
    if (!backup.ok) return backup
    if (!backup.value?.storageKey || backup.value.status !== 'COMPLETED') {
      return err(backupNotFound())
    }

    await recordAdminAction({
      actor: admin.value,
      action: 'backup.download',
      audit: { entity: 'backup', action: 'download' },
      targetType: 'backup',
      targetId: backupId,
      targetLabel: backup.value.workspaceSlug ?? backup.value.scope,
    })

    const name = backup.value.storageKey.split('/').at(-1) ?? backupId
    return ok({
      bucket: BACKUP_BUCKET,
      key: backup.value.storageKey,
      filename: `steel-${backup.value.scope.toLowerCase()}-${name}`,
    })
  },

  /**
   * Restaura um workspace a partir de um backup WORKSPACE (job). Confirmação
   * forte: o admin digita o slug do workspace do backup.
   */
  async requestRestore(
    actorId: string,
    backupId: string,
    input: ConfirmedWorkspaceActionInput,
  ): Promise<Result<AdminOperationDTO>> {
    const admin = await assertPlatformAdmin(actorId)
    if (!admin.ok) return admin

    const backup = await BackupRepository.findById(backupId)
    if (!backup.ok) return backup
    if (!backup.value) return err(backupNotFound())
    const { workspaceId } = backup.value
    if (backup.value.scope !== 'WORKSPACE' || !workspaceId) {
      return err(
        backupNotRestorable(
          'Backup completo não é restaurado pelo painel — siga o runbook de restore.',
        ),
      )
    }
    if (backup.value.status !== 'COMPLETED' || !backup.value.storageKey) {
      return err(backupNotRestorable('O backup não foi concluído'))
    }

    const current = await WorkspaceRepository.findWithMemberCount(workspaceId)
    if (!current.ok) return current
    const slug = current.value?.slug ?? backup.value.workspaceSlug
    if (!slug) return err(notFound('Workspace'))
    if (input.confirmSlug !== slug) return err(workspaceConfirmationMismatch())

    const active =
      await AdminOperationRepository.findActiveByWorkspace(workspaceId)
    if (!active.ok) return active
    if (active.value || current.value?.status === 'DELETING') {
      return err(workspaceOperationInProgress())
    }

    // Workspace excluído cujo slug foi reaproveitado: o restore falharia na
    // unique do slug depois de enfileirado.
    if (!current.value) {
      const taken = await WorkspaceRepository.findBySlug(slug)
      if (!taken.ok) return taken
      if (taken.value) {
        return err(conflict(`O slug "${slug}" já é usado por outro workspace`))
      }
    }

    const operation = await AdminOperationRepository.create({
      kind: 'WORKSPACE_RESTORE',
      workspaceId,
      workspaceSlug: slug,
      workspaceName: current.value?.name ?? slug,
      backupId,
      requestedById: admin.value.userId,
      requestedByEmail: admin.value.email,
      reason: input.reason,
      meta: { workspaceExisted: current.value !== null },
    })
    if (!operation.ok) return operation

    try {
      await enqueueAdminOperation('restore', operation.value.id)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await AdminOperationRepository.markFailed(operation.value.id, message)
      return err(queueUnavailable())
    }

    await recordAdminAction({
      actor: admin.value,
      action: 'workspace.restore_requested',
      audit: { entity: 'workspace', action: 'restore' },
      targetType: 'workspace',
      targetId: workspaceId,
      targetLabel: slug,
      reason: input.reason,
      meta: { operationId: operation.value.id, backupId },
    })

    return ok(toAdminOperationDTO(operation.value))
  },
}
