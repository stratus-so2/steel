import type {
  CrmLandingPage,
  CrmLandingPageSection,
  CrmLandingPageView,
} from '@prisma/client'
import type { CrmLandingPageSectionContent } from '@/src/schemas/crm-landing-page-section.schema'
import type {
  CrmLandingPageDTO,
  CrmLandingPagePublicDTO,
  CrmLandingPageSectionDTO,
  CrmLandingPageViewDTO,
} from '@/types/crm-landing-page'

export function toCrmLandingPageSectionDTO(
  section: CrmLandingPageSection,
): CrmLandingPageSectionDTO {
  return {
    id: section.id,
    type: section.type,
    order: section.order,
    enabled: section.enabled,
    content: section.content as unknown as CrmLandingPageSectionContent,
  }
}

export function toCrmLandingPageDTO(
  page: CrmLandingPage & {
    sections?: CrmLandingPageSection[]
    _count?: { views: number }
  },
): CrmLandingPageDTO {
  return {
    id: page.id,
    title: page.title,
    templateKey: page.templateKey,
    status: page.status,
    shareToken: page.shareToken,
    viewsCount: page._count?.views ?? 0,
    sections: (page.sections ?? []).map(toCrmLandingPageSectionDTO),
    publishedAt: page.publishedAt ? page.publishedAt.toISOString() : null,
    workspaceId: page.workspaceId,
    createdById: page.createdById,
    updatedById: page.updatedById,
    position: page.position,
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
  }
}

export function toCrmLandingPagePublicDTO(
  page: CrmLandingPage & { sections: CrmLandingPageSection[] },
): CrmLandingPagePublicDTO {
  return {
    title: page.title,
    templateKey: page.templateKey,
    sections: page.sections.map(toCrmLandingPageSectionDTO),
  }
}

export function toCrmLandingPageViewDTO(
  view: CrmLandingPageView,
): CrmLandingPageViewDTO {
  return {
    id: view.id,
    landingPageId: view.landingPageId,
    viewId: view.viewId,
    ipHash: view.ipHash,
    durationMs: view.durationMs,
    ctaClicks: view.ctaClicks,
    referrer: view.referrer,
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  }
}
