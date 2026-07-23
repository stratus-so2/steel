import type { CrmTask } from '@prisma/client'
import type { CrmTaskDTO } from '@/types/crm-task'

export function toCrmTaskDTO(task: CrmTask): CrmTaskDTO {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    body: task.body,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    assigneeId: task.assigneeId,
    companyId: task.companyId,
    personId: task.personId,
    opportunityId: task.opportunityId,
    workspaceId: task.workspaceId,
    createdById: task.createdById,
    updatedById: task.updatedById,
    position: task.position,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }
}
