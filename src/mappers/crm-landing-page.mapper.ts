import type { CrmLandingPage, CrmLandingPageView } from '@prisma/client'
import type {
  CrmLandingPageDTO,
  CrmLandingPagePublicDTO,
  CrmLandingPageViewDTO,
} from '@/types/crm-landing-page'

export function toCrmLandingPageDTO(page: CrmLandingPage): CrmLandingPageDTO {
  return {
    id: page.id,
    title: page.title,
    html: page.html,
    status: page.status,
    shareToken: page.shareToken,
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
  page: CrmLandingPage,
): CrmLandingPagePublicDTO {
  return {
    title: page.title,
    html: page.html,
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
