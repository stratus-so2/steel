import type {
  CrmProposalSectionContent,
  CrmProposalSectionType,
} from '@/src/schemas/crm-proposal.schema'

export interface CrmProposalTemplateSectionDTO {
  id: string
  type: CrmProposalSectionType
  order: number
  enabled: boolean
  defaultContent: CrmProposalSectionContent | null
}

export interface CrmProposalTemplateDTO {
  id: string
  name: string
  description: string | null
  logoUrl: string | null
  sections: CrmProposalTemplateSectionDTO[]
  workspaceId: string
  createdById: string
  updatedById: string | null
  position: number
  createdAt: string
  updatedAt: string
}
