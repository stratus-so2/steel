import { createId } from '@paralleldrive/cuid2'
import type {
  CrmProposalTemplate,
  CrmProposalTemplateSection,
  Prisma,
} from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { CrmProposalTemplateDTO } from '@/types/crm-proposal-template'

export function createFakeCrmProposalTemplate(
  overrides?: Partial<CrmProposalTemplate>,
): CrmProposalTemplate {
  const now = new Date()
  return {
    id: createId(),
    name: 'Template Padrão',
    description: null,
    logoUrl: null,
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

export function createFakeCrmProposalTemplateSection(
  overrides?: Partial<CrmProposalTemplateSection>,
): CrmProposalTemplateSection {
  const now = new Date()
  return {
    id: createId(),
    templateId: createId(),
    type: 'COVER',
    order: 0,
    enabled: true,
    defaultContent: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function createFakeCrmProposalTemplateDTO(
  overrides?: Partial<CrmProposalTemplateDTO>,
): CrmProposalTemplateDTO {
  const now = new Date().toISOString()
  return {
    id: createId(),
    name: 'Template Padrão',
    description: null,
    logoUrl: null,
    sections: [],
    workspaceId: createId(),
    createdById: createId(),
    updatedById: null,
    position: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedCrmProposalTemplate(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<
    Pick<CrmProposalTemplate, 'name' | 'description' | 'position' | 'deletedAt'>
  >,
) {
  return prisma.crmProposalTemplate.create({
    data: {
      name: 'Seed Template',
      workspaceId,
      createdById,
      ...overrides,
    },
  })
}

export async function seedCrmProposalTemplateSection(
  templateId: string,
  overrides?: Partial<
    Pick<CrmProposalTemplateSection, 'type' | 'order' | 'enabled'>
  > & { defaultContent?: Prisma.InputJsonValue },
) {
  return prisma.crmProposalTemplateSection.create({
    data: {
      templateId,
      type: 'TERMS_CONDITIONS',
      order: 0,
      ...overrides,
    },
  })
}
