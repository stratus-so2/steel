export type CrmLandingPageStatusDTO = 'DRAFT' | 'PUBLISHED'

export interface CrmLandingPageDTO {
  id: string
  title: string
  html: string
  status: CrmLandingPageStatusDTO
  shareToken: string
  publishedAt: string | null
  workspaceId: string
  createdById: string
  updatedById: string | null
  position: number
  createdAt: string
  updatedAt: string
}

export interface CrmLandingPagePublicDTO {
  title: string
  html: string
}

export interface CrmLandingPageViewDTO {
  id: string
  landingPageId: string
  viewId: string
  ipHash: string
  durationMs: number
  ctaClicks: number
  referrer: string | null
  createdAt: string
  updatedAt: string
}
