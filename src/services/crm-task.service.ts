import { auditMutation } from '@/lib/axiom/audit'
import { ok, type Result } from '@/src/lib/result'
import { toCrmTaskDTO } from '@/src/mappers/crm-task.mapper'
import { CrmTaskRepository } from '@/src/repositories/crm-task.repository'
import type {
  CreateCrmTaskDTO,
  ListCrmTasksDTO,
  UpdateCrmTaskDTO,
} from '@/src/schemas/crm-task.schema'
import type { CrmTaskDTO } from '@/types/crm-task'
import { assertMember } from './authz'

export const CrmTaskService = {
  async list(
    actorId: string,
    workspaceId: string,
    filters: ListCrmTasksDTO,
  ): Promise<Result<CrmTaskDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmTaskRepository.listByWorkspace(workspaceId, filters)
    if (!result.ok) return result

    return ok(result.value.map(toCrmTaskDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmTaskDTO,
  ): Promise<Result<CrmTaskDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmTaskRepository.create({
      workspaceId,
      createdById: actorId,
      title: dto.title,
      status: dto.status,
      body: dto.body,
      dueDate: dto.dueDate,
      assigneeId: dto.assigneeId,
      companyId: dto.companyId,
      personId: dto.personId,
      opportunityId: dto.opportunityId,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_task',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_task',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toCrmTaskDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    taskId: string,
    dto: UpdateCrmTaskDTO,
  ): Promise<Result<CrmTaskDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmTaskRepository.findById(taskId, workspaceId)
    if (!existing.ok) return existing

    const result = await CrmTaskRepository.update(taskId, {
      title: dto.title,
      status: dto.status,
      body: dto.body,
      dueDate: dto.dueDate,
      assigneeId: dto.assigneeId,
      updatedById: actorId,
    })
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_task',
      action: 'update',
      actorId,
      targetId: taskId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toCrmTaskDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    taskId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmTaskRepository.findById(taskId, workspaceId)
    if (!existing.ok) return existing

    const result = await CrmTaskRepository.softDelete(taskId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_task',
      action: 'delete',
      actorId,
      targetId: taskId,
    })

    return ok(undefined)
  },
}
