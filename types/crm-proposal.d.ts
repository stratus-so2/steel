export type CrmDocumentTypeDTO =
  | 'PREMISES'
  | 'PORTFOLIO'
  | 'PROPOSAL'
  | 'CONTRACT'

export type CrmProposalStatusDTO = 'DRAFT' | 'PUBLISHED'

export interface CrmProposalDTO {
  id: string
  title: string
  content: string
  contentJson: string | null
  type: CrmDocumentTypeDTO
  status: CrmProposalStatusDTO
  shareToken: string
  publishedAt: string | null
  viewsCount: number
  workspaceId: string
  createdById: string
  updatedById: string | null
  position: number
  createdAt: string
  updatedAt: string
}

export interface CrmProposalPublicDTO {
  id: string
  title: string
  content: string
  type: CrmDocumentTypeDTO
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
