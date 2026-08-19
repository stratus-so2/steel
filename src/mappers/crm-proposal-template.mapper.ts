import type {
  CrmProposalTemplate,
  CrmProposalTemplateSection,
} from '@prisma/client'
import type { CrmProposalSectionContent } from '@/src/schemas/crm-proposal.schema'
import type {
  CrmProposalTemplateDTO,
  CrmProposalTemplateSectionDTO,
} from '@/types/crm-proposal-template'

export function toCrmProposalTemplateSectionDTO(
  section: CrmProposalTemplateSection,
): CrmProposalTemplateSectionDTO {
  return {
    id: section.id,
    type: section.type,
    order: section.order,
    enabled: section.enabled,
    defaultContent: section.defaultContent
      ? (section.defaultContent as unknown as CrmProposalSectionContent)
      : null,
  }
}

export function toCrmProposalTemplateDTO(
  template: CrmProposalTemplate & { sections?: CrmProposalTemplateSection[] },
): CrmProposalTemplateDTO {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    logoUrl: template.logoUrl,
    sections: (template.sections ?? []).map(toCrmProposalTemplateSectionDTO),
    workspaceId: template.workspaceId,
    createdById: template.createdById,
    updatedById: template.updatedById,
    position: template.position,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  }
}
