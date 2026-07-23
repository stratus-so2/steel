import { createId } from '@paralleldrive/cuid2'
import type { CrmTask } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { CrmTaskDTO } from '@/types/crm-task'

export function createFakeCrmTask(overrides?: Partial<CrmTask>): CrmTask {
  const now = new Date()
  return {
    id: createId(),
    title: 'Ligar pro cliente',
    status: 'TODO',
    body: null,
    dueDate: null,
    assigneeId: null,
    companyId: null,
    personId: null,
    opportunityId: null,
    workspaceId: createId(),
    createdById: createId(),
    updatedById: null,
    position: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

export function createFakeCrmTaskDTO(
  overrides?: Partial<CrmTaskDTO>,
): CrmTaskDTO {
  const now = new Date().toISOString()
  return {
    id: createId(),
    title: 'Ligar pro cliente',
    status: 'TODO',
    body: null,
    dueDate: null,
    assigneeId: null,
    companyId: null,
    personId: null,
    opportunityId: null,
    workspaceId: createId(),
    createdById: createId(),
    updatedById: null,
    position: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedCrmTask(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<
    Pick<
      CrmTask,
      | 'title'
      | 'status'
      | 'companyId'
      | 'personId'
      | 'opportunityId'
      | 'assigneeId'
      | 'position'
      | 'deletedAt'
    >
  >,
) {
  return prisma.crmTask.create({
    data: { title: 'Seed Task', workspaceId, createdById, ...overrides },
  })
}
