import type { Plan } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { recordAdminAction } from '@/src/lib/admin-audit'
import { indexSearchDocument } from '@/src/lib/search/index-hooks'
import type {
  WorkspaceDeletionDTO,
  WorkspaceDTO,
  WorkspaceSlugAvailabilityDTO,
} from '@/types/workspace'
import { UserCache } from '../cache/user.cache'
import { WorkspaceCache } from '../cache/workspace.cache'
import { TRIAL_PLAN, trialEndsAtFrom } from '../config/trial'
import { forbidden, workspaceConfirmationMismatch } from '../errors'
import { err, ok, type Result } from '../lib/result'
import { toWorkspaceDTO } from '../mappers/workspace.mapper'
import { MembershipRepository } from '../repositories/membership.repository'
import { UserRepository } from '../repositories/user.repository'
import { WorkspaceRepository } from '../repositories/workspace.repository'
import {
  type CreateWorkspaceDTO,
  type DeleteWorkspaceRequestDTO,
  isReservedWorkspaceSlug,
  type UpdateWorkspaceDTO,
  WorkspaceSlugSchema,
} from '../schemas/workspace.schema'
import { assertMember } from './authz'
import { queueWorkspaceDeletion } from './workspace-deletion'

/** Reason stored on the deletion operation (shown in the admin panel). */
export const OWNER_DELETION_REASON =
  'Exclusão solicitada pelo dono do workspace em Ajustes > Geral'

/**
 * Drops the workspace DTO cache and every member's user cache (the user DTO
 * carries the workspace name, slug and logo for the workspace switcher).
 */
export async function refreshWorkspaceCaches(
  workspaceId: string,
  actorId: string,
): Promise<void> {
  await WorkspaceCache.invalidate(workspaceId)
  const membersIds = await MembershipRepository.listUserByWorkspace(workspaceId)
  await Promise.all(
    (membersIds.ok ? membersIds.value : [actorId]).map((id) =>
      UserCache.invalidate(id),
    ),
  )
}

export const WorkspaceService = {
  async getById(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<WorkspaceDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const cached = await WorkspaceCache.get(workspaceId)
    if (cached) return ok(cached)

    const result = await WorkspaceRepository.findById(workspaceId)
    if (!result.ok) return result

    const dto = toWorkspaceDTO(result.value)
    await WorkspaceCache.set(workspaceId, dto)

    return ok(dto)
  },

  async create(
    actorId: string,
    dto: CreateWorkspaceDTO,
  ): Promise<Result<WorkspaceDTO>> {
    const result = await WorkspaceRepository.createWithOwner(
      {
        ...dto,
        activePlan: TRIAL_PLAN as Plan,
        trialEndsAt: trialEndsAtFrom(),
      },
      actorId,
    )
    if (!result.ok) {
      auditMutation({
        entity: 'workspace',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    await UserCache.invalidate(actorId)

    auditMutation({
      entity: 'workspace',
      action: 'create',
      actorId,
      targetId: result.value.id,
      meta: { trialPlan: TRIAL_PLAN },
    })

    void indexSearchDocument('member', result.value.id, actorId)
    return ok(toWorkspaceDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    dto: UpdateWorkspaceDTO,
  ): Promise<Result<WorkspaceDTO>> {
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
        meta: { role: membership.value.role },
      })
      return err(forbidden('Apenas OWNER ou ADMIN podem editar o workspace'))
    }

    // The old slug goes to the audit trail: links with it stop working.
    let previousSlug: string | null = null
    if (dto.slug !== undefined) {
      const current = await WorkspaceRepository.findById(workspaceId)
      if (!current.ok) return current
      previousSlug = current.value.slug
    }

    const result = await WorkspaceRepository.update(workspaceId, dto)
    if (!result.ok) {
      auditMutation({
        entity: 'workspace',
        action: 'update',
        actorId,
        targetId: workspaceId,
        outcome: 'failure',
        reason: result.error.code,
        meta: { fields: Object.keys(dto) },
      })
      return result
    }

    await refreshWorkspaceCaches(workspaceId, actorId)

    const slugChanged =
      previousSlug !== null && previousSlug !== result.value.slug
    auditMutation({
      entity: 'workspace',
      action: 'update',
      actorId,
      targetId: workspaceId,
      meta: {
        fields: Object.keys(dto),
        ...(slugChanged
          ? { previousSlug, slug: result.value.slug }
          : undefined),
      },
    })

    return ok(toWorkspaceDTO(result.value))
  },

  /**
   * Live check for the "URL do espaço de trabalho" field: format, reserved
   * words and uniqueness. The current slug counts as available.
   */
  async checkSlugAvailability(
    actorId: string,
    workspaceId: string,
    slug: string,
  ): Promise<Result<WorkspaceSlugAvailabilityDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership
    if (!membership.value.isPrivileged) {
      return err(forbidden('Apenas OWNER ou ADMIN podem editar o workspace'))
    }

    const parsed = WorkspaceSlugSchema.safeParse(slug)
    if (!parsed.success) {
      return ok({
        slug,
        available: false,
        reason: isReservedWorkspaceSlug(slug) ? 'reserved' : 'invalid',
        // Zod always reports at least one issue on failure.
        message: parsed.error.issues[0].message,
      })
    }

    const existing = await WorkspaceRepository.findBySlug(slug)
    if (!existing.ok) return existing

    if (existing.value && existing.value.id === workspaceId) {
      return ok({ slug, available: true, reason: 'current', message: null })
    }
    if (existing.value) {
      return ok({
        slug,
        available: false,
        reason: 'taken',
        message: 'Este endereço já está em uso. Escolha outro.',
      })
    }
    return ok({ slug, available: true, reason: null, message: null })
  },

  /**
   * The owner asks for the permanent deletion. Same pipeline as the platform
   * admin (`queueWorkspaceDeletion`): the workspace is blocked right away and
   * the worker backs it up, cancels the subscriptions and purges rows and
   * files in the background.
   */
  async requestDeletion(
    actorId: string,
    workspaceId: string,
    dto: DeleteWorkspaceRequestDTO,
  ): Promise<Result<WorkspaceDeletionDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    if (membership.value.role !== 'OWNER') {
      auditMutation({
        entity: 'workspace',
        action: 'delete',
        actorId,
        targetId: workspaceId,
        outcome: 'failure',
        reason: 'insufficient_role',
        meta: { role: membership.value.role },
      })
      return err(forbidden('Apenas o OWNER pode excluir o workspace'))
    }

    const workspace = await WorkspaceRepository.findById(workspaceId)
    if (!workspace.ok) return workspace

    if (dto.confirmation !== workspace.value.slug) {
      auditMutation({
        entity: 'workspace',
        action: 'delete',
        actorId,
        targetId: workspaceId,
        outcome: 'failure',
        reason: 'confirmation_mismatch',
      })
      return err(workspaceConfirmationMismatch())
    }

    const requester = await UserRepository.findById(actorId)
    if (!requester.ok) return requester

    const operation = await queueWorkspaceDeletion({
      workspace: workspace.value,
      requester: { userId: actorId, email: requester.value.email },
      reason: OWNER_DELETION_REASON,
      ignoreSubscriptionCancelFailure: false,
    })
    if (!operation.ok) {
      auditMutation({
        entity: 'workspace',
        action: 'delete',
        actorId,
        targetId: workspaceId,
        outcome: 'failure',
        reason: operation.error.code,
      })
      return operation
    }

    // Axiom + `admin_audit_logs`, so IT sees it in the workspace timeline.
    await recordAdminAction({
      actor: { userId: actorId, email: requester.value.email },
      action: 'workspace.delete_requested',
      audit: { entity: 'workspace', action: 'delete' },
      targetType: 'workspace',
      targetId: workspaceId,
      targetLabel: workspace.value.slug,
      reason: OWNER_DELETION_REASON,
      meta: { operationId: operation.value.id, requestedBy: 'owner' },
    })

    await refreshWorkspaceCaches(workspaceId, actorId)

    return ok({
      operationId: operation.value.id,
      status: 'QUEUED',
      requestedAt: operation.value.createdAt.toISOString(),
    })
  },
}
