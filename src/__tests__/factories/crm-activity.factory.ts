import { createId } from '@paralleldrive/cuid2'
import type { CrmActivity } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { CrmActivityDTO } from '@/types/crm-activity'

export function createFakeCrmActivity(
  overrides?: Partial<CrmActivity>,
): CrmActivity {
  return {
    id: createId(),
    workspaceId: createId(),
    actorUserId: null,
    action: 'CREATED',
    entity: 'crm_company',
    entityId: createId(),
    companyId: null,
    personId: null,
    opportunityId: null,
    summary: null,
    createdAt: new Date(),
    ...overrides,
  }
}

export function createFakeCrmActivityDTO(
  overrides?: Partial<CrmActivityDTO>,
): CrmActivityDTO {
  return {
    id: createId(),
    workspaceId: createId(),
    actorUserId: null,
    action: 'CREATED',
    entity: 'crm_company',
    entityId: createId(),
    companyId: null,
    personId: null,
    opportunityId: null,
    summary: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

export async function seedCrmActivity(
  workspaceId: string,
  overrides?: Partial<
    Pick<
      CrmActivity,
      | 'actorUserId'
      | 'action'
      | 'entity'
      | 'entityId'
      | 'companyId'
      | 'personId'
      | 'opportunityId'
      | 'summary'
    >
  >,
) {
  return prisma.crmActivity.create({
    data: {
      workspaceId,
      action: 'CREATED',
      entity: 'crm_company',
      entityId: createId(),
      ...overrides,
    },
  })
}
