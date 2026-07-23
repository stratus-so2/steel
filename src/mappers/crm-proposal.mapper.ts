import type { CrmProposal, CrmProposalView } from '@prisma/client'
import type { CrmProposalMetricsRaw } from '@/src/repositories/crm-proposal.repository'
import type {
  CrmProposalDTO,
  CrmProposalMetricsDTO,
  CrmProposalPublicDTO,
  CrmProposalViewDTO,
} from '@/types/crm-proposal'

export function toCrmProposalDTO(
  proposal: CrmProposal & { _count?: { views: number } },
): CrmProposalDTO {
  return {
    id: proposal.id,
    title: proposal.title,
    content: proposal.content,
    contentJson: proposal.contentJson,
    type: proposal.type,
    status: proposal.status,
    shareToken: proposal.shareToken,
    publishedAt: proposal.publishedAt
      ? proposal.publishedAt.toISOString()
      : null,
    viewsCount: proposal._count?.views ?? 0,
    workspaceId: proposal.workspaceId,
    createdById: proposal.createdById,
    updatedById: proposal.updatedById,
    position: proposal.position,
    createdAt: proposal.createdAt.toISOString(),
    updatedAt: proposal.updatedAt.toISOString(),
  }
}

export function toCrmProposalPublicDTO(
  proposal: CrmProposal,
): CrmProposalPublicDTO {
  return {
    id: proposal.id,
    title: proposal.title,
    content: proposal.content,
    type: proposal.type,
  }
}

export function toCrmProposalViewDTO(
  view: CrmProposalView,
): CrmProposalViewDTO {
  return {
    id: view.id,
    durationMs: view.durationMs,
    reachedEnd: view.reachedEnd,
    scrolledPct: view.scrolledPct,
    referrer: view.referrer,
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  }
}

/** Agregados crus → DTO de métricas (deriva `completionRate`). */
export function toCrmProposalMetricsDTO(
  raw: CrmProposalMetricsRaw,
): CrmProposalMetricsDTO {
  return {
    totalViews: raw.totalViews,
    uniqueVisitors: raw.uniqueVisitors,
    completionRate: raw.totalViews ? raw.completed / raw.totalViews : 0,
    avgDurationMs: raw.avgDurationMs,
    views: raw.views.map(toCrmProposalViewDTO),
  }
}
