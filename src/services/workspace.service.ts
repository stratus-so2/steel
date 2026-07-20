import type { Plan } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import type { WorkspaceDTO } from '@/types/workspace'
import { UserCache } from '../cache/user.cache'
import { WorkspaceCache } from '../cache/workspace.cache'
import { TRIAL_PLAN, trialEndsAtFrom } from '../config/trial'
import { forbidden } from '../errors'
import { err, ok, type Result } from '../lib/result'
import { toWorkspaceDTO } from '../mappers/workspace.mapper'
import { MembershipRepository } from '../repositories/membership.repository'
import { WorkspaceRepository } from '../repositories/workspace.repository'
import type {
  CreateWorkspaceDTO,
  UpdateWorkspaceDTO,
} from '../schemas/workspace.schema'
import { assertMember } from './authz'

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
      return err(forbidden('Apneas OWNER ou ADMIN podem editar o workspace'))
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
      })
      return result
    }

    const workspaceDTO = toWorkspaceDTO(result.value)
    await WorkspaceCache.invalidate(workspaceId)

    const membersIds =
      await MembershipRepository.listUserByWorkspace(workspaceId)
    await Promise.all(
      (membersIds.ok ? membersIds.value : [actorId]).map((id) =>
        UserCache.invalidate(id),
      ),
    )

    auditMutation({
      entity: 'workspace',
      action: 'update',
      actorId,
      targetId: workspaceId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(workspaceDTO)
  },

  async delete(actorId: string, workspaceId: string): Promise<Result<void>> {
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
      return err(forbidden('Apenas o OWNER pode deletar o workspace'))
    }

    const membersIds =
      await MembershipRepository.listUserByWorkspace(workspaceId)

    const result = await WorkspaceRepository.delete(workspaceId)
    if (!result.ok) {
      auditMutation({
        entity: 'workspace',
        action: 'delete',
        actorId,
        targetId: workspaceId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    await WorkspaceCache.invalidate(workspaceId)
    await Promise.all(
      (membersIds.ok ? membersIds.value : [actorId]).map((id) =>
        UserCache.invalidate(id),
      ),
    )

    auditMutation({
      entity: 'workspace',
      action: 'delete',
      actorId,
      targetId: workspaceId,
    })

    return ok(undefined)
  },
}
