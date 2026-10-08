import type { AdminOperation, Workspace } from '@prisma/client'
import { logFields } from '@/lib/axiom/log-fields'
import { logger } from '@/lib/axiom/logger'
import { WorkspaceCache } from '@/src/cache/workspace.cache'
import { WorkspaceFeaturesCache } from '@/src/cache/workspace-features.cache'
import { workspaceOperationInProgress } from '@/src/errors'
import { appError } from '@/src/errors/app-error'
import { enqueueAdminOperation } from '@/src/lib/queue/database-backup'
import { err, ok, type Result } from '@/src/lib/result'
import { AdminOperationRepository } from '@/src/repositories/admin-operation.repository'
import { WorkspaceRepository } from '@/src/repositories/workspace.repository'

export interface QueueWorkspaceDeletionInput {
  workspace: Pick<Workspace, 'id' | 'slug' | 'name' | 'status'>
  requester: { userId: string; email: string }
  /** Shown in the admin panel and kept in the audit trail. */
  reason: string
  ignoreSubscriptionCancelFailure: boolean
}

export async function invalidateWorkspaceCaches(
  workspaceId: string,
): Promise<void> {
  await Promise.all([
    WorkspaceCache.invalidate(workspaceId),
    WorkspaceFeaturesCache.invalidate(workspaceId),
  ]).catch(() => undefined)
}

/**
 * The single workspace deletion pipeline, shared by the platform admin
 * (`/admin/workspaces`) and the owner (Ajustes > Geral): records a
 * `WORKSPACE_DELETE` operation, marks the workspace `DELETING` (members are
 * blocked right away) and enqueues the worker job, which takes a backup,
 * cancels the subscriptions at AbacatePay and only then purges rows and
 * files (`runWorkspaceDeletion`). Authorization and the confirmation check are
 * the caller's job.
 */
export async function queueWorkspaceDeletion(
  input: QueueWorkspaceDeletionInput,
): Promise<Result<AdminOperation>> {
  const { workspace } = input

  const active = await AdminOperationRepository.findActiveByWorkspace(
    workspace.id,
  )
  if (!active.ok) return active
  if (active.value || workspace.status === 'DELETING') {
    return err(workspaceOperationInProgress())
  }

  const operation = await AdminOperationRepository.create({
    kind: 'WORKSPACE_DELETE',
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
    workspaceName: workspace.name,
    requestedById: input.requester.userId,
    requestedByEmail: input.requester.email,
    reason: input.reason,
    meta: {
      previousStatus: workspace.status,
      ignoreSubscriptionCancelFailure: input.ignoreSubscriptionCancelFailure,
    },
  })
  if (!operation.ok) return operation

  const marked = await WorkspaceRepository.setStatus(workspace.id, {
    status: 'DELETING',
  })
  if (!marked.ok) {
    await AdminOperationRepository.markFailed(
      operation.value.id,
      'Falha ao marcar o workspace para exclusão',
    )
    return marked
  }
  await invalidateWorkspaceCaches(workspace.id)

  try {
    await enqueueAdminOperation('delete', operation.value.id)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await AdminOperationRepository.markFailed(operation.value.id, message)
    await WorkspaceRepository.setStatus(workspace.id, {
      status: workspace.status,
    })
    await invalidateWorkspaceCaches(workspace.id)
    logger.error(
      'workspace.delete_enqueue_failed',
      logFields(
        { component: 'WorkspaceDeletion', workspaceId: workspace.id, message },
        { actorId: input.requester.userId, operationId: operation.value.id },
      ),
    )
    return err(
      appError(
        'INTERNAL_SERVER_ERROR',
        'Não foi possível enfileirar a exclusão. Nada foi apagado.',
      ),
    )
  }

  return ok(operation.value)
}
