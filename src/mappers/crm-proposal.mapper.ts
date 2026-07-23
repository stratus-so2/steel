import type { CrmProposal } from '@prisma/client'
import type { CrmProposalDTO, CrmProposalPublicDTO } from '@/types/crm-proposal'

export function toCrmProposalDTO(proposal: CrmProposal): CrmProposalDTO {
  return {
    id: proposal.id,
    title: proposal.title,
    content: proposal.content,
    type: proposal.type,
    status: proposal.status,
    shareToken: proposal.shareToken,
    publishedAt: proposal.publishedAt
      ? proposal.publishedAt.toISOString()
      : null,
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
