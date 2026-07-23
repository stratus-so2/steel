import { createId } from '@paralleldrive/cuid2'
import type { CrmProposal, CrmProposalView } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { CrmProposalDTO } from '@/types/crm-proposal'

export function createFakeCrmProposal(
  overrides?: Partial<CrmProposal>,
): CrmProposal {
  const now = new Date()
  return {
    id: createId(),
    title: 'Proposta X',
    content: '',
    type: 'PROPOSAL',
    status: 'DRAFT',
    shareToken: createId(),
    publishedAt: null,
    workspaceId: createId(),
    createdById: createId(),
    updatedById: null,
    position: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

export function createFakeCrmProposalDTO(
  overrides?: Partial<CrmProposalDTO>,
): CrmProposalDTO {
  const now = new Date().toISOString()
  return {
    id: createId(),
    title: 'Proposta X',
    content: '',
    type: 'PROPOSAL',
    status: 'DRAFT',
    shareToken: createId(),
    publishedAt: null,
    viewsCount: 0,
    workspaceId: createId(),
    createdById: createId(),
    updatedById: null,
    position: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedCrmProposal(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<
    Pick<
      CrmProposal,
      'title' | 'content' | 'status' | 'publishedAt' | 'position' | 'deletedAt'
    >
  >,
) {
  return prisma.crmProposal.create({
    data: {
      title: 'Seed Proposal',
      shareToken: createId(),
      workspaceId,
      createdById,
      ...overrides,
    },
  })
}

export async function seedCrmProposalView(
  proposalId: string,
  overrides?: Partial<
    Pick<
      CrmProposalView,
      'viewId' | 'durationMs' | 'reachedEnd' | 'scrolledPct'
    >
  >,
) {
  return prisma.crmProposalView.create({
    data: {
      proposalId,
      viewId: createId(),
      ipHash: 'hash',
      ...overrides,
    },
  })
}
