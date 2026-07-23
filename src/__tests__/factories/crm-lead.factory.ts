import { createId } from '@paralleldrive/cuid2'
import type {
  CrmLead,
  CrmLeadRoutingRule,
  CrmLeadScoringRule,
} from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type {
  CrmLeadDTO,
  CrmLeadRoutingRuleDTO,
  CrmLeadScoringRuleDTO,
} from '@/types/crm-lead'

export function createFakeCrmLead(overrides?: Partial<CrmLead>): CrmLead {
  const now = new Date()
  return {
    id: createId(),
    workspaceId: createId(),
    name: 'Jane Doe',
    emails: [],
    phones: [],
    company: null,
    jobTitle: null,
    city: null,
    linkedin: null,
    source: null,
    status: 'NEW',
    score: 0,
    ownerId: null,
    convertedPersonId: null,
    createdById: createId(),
    updatedById: null,
    position: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

export function createFakeCrmLeadDTO(
  overrides?: Partial<CrmLeadDTO>,
): CrmLeadDTO {
  const now = new Date().toISOString()
  return {
    id: createId(),
    workspaceId: createId(),
    name: 'Jane Doe',
    emails: [],
    phones: [],
    company: null,
    jobTitle: null,
    city: null,
    linkedin: null,
    source: null,
    status: 'NEW',
    score: 0,
    ownerId: null,
    convertedPersonId: null,
    createdById: createId(),
    updatedById: null,
    position: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedCrmLead(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<
    Pick<
      CrmLead,
      | 'name'
      | 'emails'
      | 'company'
      | 'source'
      | 'status'
      | 'score'
      | 'ownerId'
      | 'position'
      | 'deletedAt'
    >
  >,
) {
  return prisma.crmLead.create({
    data: { name: 'Seed Lead', workspaceId, createdById, ...overrides },
  })
}

export function createFakeCrmLeadScoringRule(
  overrides?: Partial<CrmLeadScoringRule>,
): CrmLeadScoringRule {
  const now = new Date()
  return {
    id: createId(),
    workspaceId: createId(),
    field: 'email',
    operator: 'is_not_empty',
    value: null,
    points: 10,
    active: true,
    position: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function createFakeCrmLeadScoringRuleDTO(
  overrides?: Partial<CrmLeadScoringRuleDTO>,
): CrmLeadScoringRuleDTO {
  const now = new Date().toISOString()
  return {
    id: createId(),
    workspaceId: createId(),
    field: 'email',
    operator: 'is_not_empty',
    value: null,
    points: 10,
    active: true,
    position: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedCrmLeadScoringRule(
  workspaceId: string,
  overrides?: Partial<
    Pick<
      CrmLeadScoringRule,
      'field' | 'operator' | 'value' | 'points' | 'active' | 'position'
    >
  >,
) {
  return prisma.crmLeadScoringRule.create({
    data: {
      workspaceId,
      field: 'email',
      operator: 'is_not_empty',
      points: 10,
      ...overrides,
    },
  })
}

export function createFakeCrmLeadRoutingRule(
  overrides?: Partial<CrmLeadRoutingRule>,
): CrmLeadRoutingRule {
  const now = new Date()
  return {
    id: createId(),
    workspaceId: createId(),
    field: 'source',
    operator: 'equals',
    value: 'ads',
    ownerId: createId(),
    active: true,
    position: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function createFakeCrmLeadRoutingRuleDTO(
  overrides?: Partial<CrmLeadRoutingRuleDTO>,
): CrmLeadRoutingRuleDTO {
  const now = new Date().toISOString()
  return {
    id: createId(),
    workspaceId: createId(),
    field: 'source',
    operator: 'equals',
    value: 'ads',
    ownerId: createId(),
    active: true,
    position: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedCrmLeadRoutingRule(
  workspaceId: string,
  ownerId: string,
  overrides?: Partial<
    Pick<
      CrmLeadRoutingRule,
      'field' | 'operator' | 'value' | 'active' | 'position'
    >
  >,
) {
  return prisma.crmLeadRoutingRule.create({
    data: {
      workspaceId,
      ownerId,
      field: 'source',
      operator: 'equals',
      value: 'ads',
      ...overrides,
    },
  })
}
