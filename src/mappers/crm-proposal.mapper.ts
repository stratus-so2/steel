import type {
  CrmProposal,
  CrmProposalSection,
  CrmProposalView,
} from '@prisma/client'
import type { CrmProposalMetricsRaw } from '@/src/repositories/crm-proposal.repository'
import type { CrmProposalSectionContent } from '@/src/schemas/crm-proposal.schema'
import type {
  CrmProposalDTO,
  CrmProposalMetricsDTO,
  CrmProposalPublicDTO,
  CrmProposalSectionDTO,
  CrmProposalViewDTO,
} from '@/types/crm-proposal'

export function toCrmProposalSectionDTO(
  section: CrmProposalSection,
): CrmProposalSectionDTO {
  return {
    id: section.id,
    type: section.type,
    order: section.order,
    enabled: section.enabled,
    content: section.content as unknown as CrmProposalSectionContent,
  }
}

export function toCrmProposalDTO(
  proposal: CrmProposal & {
    sections?: CrmProposalSection[]
    _count?: { views: number }
  },
): CrmProposalDTO {
  return {
    id: proposal.id,
    name: proposal.name,
    templateId: proposal.templateId,
    companyId: proposal.companyId,
    contactId: proposal.contactId,
    opportunityId: proposal.opportunityId,
    leadId: proposal.leadId,
    responsibleId: proposal.responsibleId,
    validUntil: proposal.validUntil ? proposal.validUntil.toISOString() : null,
    status: proposal.status,
    shareToken: proposal.shareToken,
    viewsCount: proposal._count?.views ?? 0,
    sections: (proposal.sections ?? []).map(toCrmProposalSectionDTO),
    workspaceId: proposal.workspaceId,
    createdById: proposal.createdById,
    updatedById: proposal.updatedById,
    position: proposal.position,
    createdAt: proposal.createdAt.toISOString(),
    updatedAt: proposal.updatedAt.toISOString(),
  }
}

export function toCrmProposalPublicDTO(
  proposal: CrmProposal & { sections: CrmProposalSection[] },
): CrmProposalPublicDTO {
  return {
    id: proposal.id,
    name: proposal.name,
    status: proposal.status,
    validUntil: proposal.validUntil ? proposal.validUntil.toISOString() : null,
    sections: proposal.sections
      .filter((section) => section.enabled)
      .map(toCrmProposalSectionDTO),
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
