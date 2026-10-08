import { auditMutation } from '@/lib/axiom/audit'
import { logFields } from '@/lib/axiom/log-fields'
import { logger } from '@/lib/axiom/logger'
import { forbidden, validationError } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { deleteObject } from '@/src/lib/storage/s3'
import { toWorkspaceDTO } from '@/src/mappers/workspace.mapper'
import { WorkspaceRepository } from '@/src/repositories/workspace.repository'
import type { WorkspaceDTO } from '@/types/workspace'
import { assertMember } from '../authz'
import { refreshWorkspaceCaches } from '../workspace.service'
import { persistObject, validateImage, workspaceMediaKey } from './_media'

export const WORKSPACE_LOGO_BUCKET = 'workspace-logos'
export const WORKSPACE_LOGO_MAX_BYTES = 2 * 1024 * 1024 // 2 MB

export interface WorkspaceLogoUploadInput {
  actorId: string
  workspaceId: string
  contentType: string
  byteSize: number
  // Lazily read so authz + MIME/size are validated before buffering
  readBody: () => Promise<Buffer>
}

/** Object key of a logo URL from this bucket, or `null` for anything else. */
export function logoKeyFromUrl(url: string | null): string | null {
  if (!url) return null
  const marker = `/${WORKSPACE_LOGO_BUCKET}/`
  const index = url.indexOf(marker)
  if (index === -1) return null
  const key = url.slice(index + marker.length)
  return key.length > 0 ? key : null
}

// Best effort: an orphan logo is harmless (the workspace purge removes the
// whole `<workspaceId>/` prefix anyway), so a failure is only logged.
async function deleteLogoObject(
  workspaceId: string,
  key: string | null,
): Promise<void> {
  if (!key) return
  try {
    await deleteObject({ bucket: WORKSPACE_LOGO_BUCKET, key })
  } catch (error) {
    logger.warn(
      'workspace_logo.delete_failed',
      logFields(
        {
          component: 'WorkspaceLogoService',
          workspaceId,
          message: error instanceof Error ? error.message : String(error),
        },
        { key },
      ),
    )
  }
}

async function assertCanEdit(
  actorId: string,
  workspaceId: string,
): Promise<Result<true>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership
  if (!membership.value.isPrivileged) {
    auditMutation({
      entity: 'workspace',
      action: 'update',
      actorId,
      targetId: workspaceId,
      outcome: 'failure',
      reason: 'insufficient_role',
      meta: { role: membership.value.role, fields: ['logoUrl'] },
    })
    return err(forbidden('Apenas OWNER ou ADMIN podem editar o workspace'))
  }
  return ok(true)
}

export const WorkspaceLogoService = {
  async upload(input: WorkspaceLogoUploadInput): Promise<Result<WorkspaceDTO>> {
    const allowed = await assertCanEdit(input.actorId, input.workspaceId)
    if (!allowed.ok) return allowed

    // Type first (size 0), then the logo's own, tighter, size cap.
    const validation = validateImage(input.contentType, 0)
    if (!validation.ok) return validation
    if (input.byteSize > WORKSPACE_LOGO_MAX_BYTES) {
      return err(validationError('Arquivo muito grande. Máximo 2 MB'))
    }

    const current = await WorkspaceRepository.findById(input.workspaceId)
    if (!current.ok) return current

    // Random name per upload: the public URL changes, so no stale CDN/browser
    // cache, and the key keeps the `<workspaceId>/` prefix for backup/purge.
    const key = workspaceMediaKey(input.workspaceId, validation.value)
    const body = await input.readBody()
    const stored = await persistObject({
      bucket: WORKSPACE_LOGO_BUCKET,
      key,
      body,
      contentType: input.contentType,
      component: 'WorkspaceLogoService',
      event: 'workspace_logo.persist_failed',
    })
    if (!stored.ok) return stored

    const updated = await WorkspaceRepository.update(input.workspaceId, {
      logoUrl: stored.value,
    })
    if (!updated.ok) {
      await deleteLogoObject(input.workspaceId, key)
      auditMutation({
        entity: 'workspace',
        action: 'update',
        actorId: input.actorId,
        targetId: input.workspaceId,
        outcome: 'failure',
        reason: updated.error.code,
        meta: { fields: ['logoUrl'] },
      })
      return updated
    }

    await deleteLogoObject(
      input.workspaceId,
      logoKeyFromUrl(current.value.logoUrl),
    )
    await refreshWorkspaceCaches(input.workspaceId, input.actorId)

    auditMutation({
      entity: 'workspace',
      action: 'update',
      actorId: input.actorId,
      targetId: input.workspaceId,
      meta: {
        fields: ['logoUrl'],
        bucket: WORKSPACE_LOGO_BUCKET,
        key,
        replaced: current.value.logoUrl !== null,
      },
    })

    return ok(toWorkspaceDTO(updated.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<WorkspaceDTO>> {
    const allowed = await assertCanEdit(actorId, workspaceId)
    if (!allowed.ok) return allowed

    const current = await WorkspaceRepository.findById(workspaceId)
    if (!current.ok) return current
    if (current.value.logoUrl === null) {
      return ok(toWorkspaceDTO(current.value))
    }

    const updated = await WorkspaceRepository.update(workspaceId, {
      logoUrl: null,
    })
    if (!updated.ok) {
      auditMutation({
        entity: 'workspace',
        action: 'update',
        actorId,
        targetId: workspaceId,
        outcome: 'failure',
        reason: updated.error.code,
        meta: { fields: ['logoUrl'] },
      })
      return updated
    }

    await deleteLogoObject(workspaceId, logoKeyFromUrl(current.value.logoUrl))
    await refreshWorkspaceCaches(workspaceId, actorId)

    auditMutation({
      entity: 'workspace',
      action: 'update',
      actorId,
      targetId: workspaceId,
      meta: { fields: ['logoUrl'], removed: true },
    })

    return ok(toWorkspaceDTO(updated.value))
  },
}
