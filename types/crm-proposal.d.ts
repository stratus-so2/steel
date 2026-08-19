import type {
  CrmProposalSectionContent,
  CrmProposalSectionType,
} from '@/src/schemas/crm-proposal.schema'

export type CrmProposalStatusDTO =
  | 'DRAFT'
  | 'SENT'
  | 'VIEWED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'

export interface CrmProposalSectionDTO {
  id: string
  type: CrmProposalSectionType
  order: number
  enabled: boolean
  content: CrmProposalSectionContent
}

export interface CrmProposalDTO {
  id: string
  name: string
  templateId: string | null
  companyId: string | null
  contactId: string | null
  opportunityId: string | null
  responsibleId: string
  validUntil: string | null
  status: CrmProposalStatusDTO
  shareToken: string
  viewsCount: number
  sections: CrmProposalSectionDTO[]
  workspaceId: string
  createdById: string
  updatedById: string | null
  position: number
  createdAt: string
  updatedAt: string
}

export interface CrmProposalPublicDTO {
  id: string
  name: string
  status: CrmProposalStatusDTO
  validUntil: string | null
  sections: CrmProposalSectionDTO[]
}

export interface CrmProposalViewDTO {
  id: string
  durationMs: number
  reachedEnd: boolean
  scrolledPct: number
  referrer: string | null
  createdAt: string
  updatedAt: string
}

export interface CrmProposalMetricsDTO {
  totalViews: number
  uniqueVisitors: number
  /** Fração 0..1 de visitas que chegaram ao fim. */
  completionRate: number
  avgDurationMs: number
  views: CrmProposalViewDTO[]
}
