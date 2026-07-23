import { createId } from '@paralleldrive/cuid2'
import type { CrmPerson } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { CrmPersonDTO } from '@/types/crm-person'

export function createFakeCrmPerson(overrides?: Partial<CrmPerson>): CrmPerson {
  const now = new Date()
  return {
    id: createId(),
    name: 'Jane Doe',
    emails: [],
    phones: [],
    city: null,
    jobTitle: null,
    linkedin: null,
    avatar: null,
    companyId: null,
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

export function createFakeCrmPersonDTO(
  overrides?: Partial<CrmPersonDTO>,
): CrmPersonDTO {
  const now = new Date().toISOString()
  return {
    id: createId(),
    name: 'Jane Doe',
    emails: [],
    phones: [],
    city: null,
    jobTitle: null,
    linkedin: null,
    avatar: null,
    companyId: null,
    workspaceId: createId(),
    createdById: createId(),
    updatedById: null,
    position: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedCrmPerson(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<
    Pick<
      CrmPerson,
      | 'name'
      | 'emails'
      | 'phones'
      | 'city'
      | 'jobTitle'
      | 'companyId'
      | 'position'
      | 'deletedAt'
    >
  >,
) {
  return prisma.crmPerson.create({
    data: {
      name: 'Seed Person',
      workspaceId,
      createdById,
      ...overrides,
    },
  })
}
