import { createId } from '@paralleldrive/cuid2'
import type {
  CrmDocumentType,
  CrmProposal,
  CrmProposalView,
} from '@prisma/client'
import { notFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

/** Agregados crus de leitura; o mapper compõe o DTO (completionRate etc.). */
export type CrmProposalMetricsRaw = {
  totalViews: number
  uniqueVisitors: number
  completed: number
  avgDurationMs: number
  views: CrmProposalView[]
}

export const CrmProposalRepository = {
  async listByWorkspace(
    workspaceId: string,
  ): Promise<Result<(CrmProposal & { _count: { views: number } })[]>> {
    try {
      const proposals = await prisma.crmProposal.findMany({
        where: { workspaceId, deletedAt: null },
        orderBy: { position: 'asc' },
        include: { _count: { select: { views: true } } },
      })
      return ok(proposals)
    } catch (error) {
      return err(dbError('Failed to list CRM proposals', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<CrmProposal>> {
    try {
      const proposal = await prisma.crmProposal.findFirst({
        where: { id, workspaceId, deletedAt: null },
      })
      if (!proposal) return err(notFound('CrmProposal'))
      return ok(proposal)
    } catch (error) {
      return err(dbError('Failed to find CRM proposal by id', error))
    }
  },

  async findByShareToken(shareToken: string): Promise<Result<CrmProposal>> {
    try {
      const proposal = await prisma.crmProposal.findFirst({
        where: { shareToken, status: 'PUBLISHED', deletedAt: null },
      })
      if (!proposal) return err(notFound('CrmProposal'))
      return ok(proposal)
    } catch (error) {
      return err(dbError('Failed to find CRM proposal by share token', error))
    }
  },

  async create(data: {
    workspaceId: string
    createdById: string
    title: string
    content?: string
    contentJson?: string
    type?: CrmDocumentType
  }): Promise<Result<CrmProposal>> {
    try {
      const position = await prisma.crmProposal.count({
        where: { workspaceId: data.workspaceId, deletedAt: null },
      })
      const proposal = await prisma.crmProposal.create({
        data: { ...data, shareToken: createId(), position },
      })
      return ok(proposal)
    } catch (error) {
      return err(dbError('Failed to create CRM proposal', error))
    }
  },

  async update(
    id: string,
    data: {
      title?: string
      content?: string
      contentJson?: string
      type?: CrmDocumentType
      status?: 'DRAFT' | 'PUBLISHED'
      publishedAt?: Date
      updatedById?: string
    },
  ): Promise<Result<CrmProposal>> {
    try {
      const proposal = await prisma.crmProposal.update({
        where: { id },
        data,
      })
      return ok(proposal)
    } catch (error) {
      return err(dbError('Failed to update CRM proposal', error))
    }
  },

  async setPublished(
    id: string,
    published: boolean,
  ): Promise<Result<CrmProposal>> {
    try {
      const proposal = await prisma.crmProposal.update({
        where: { id },
        data: {
          status: published ? 'PUBLISHED' : 'DRAFT',
          publishedAt: published ? new Date() : null,
        },
      })
      return ok(proposal)
    } catch (error) {
      return err(dbError('Failed to publish CRM proposal', error))
    }
  },

  async softDelete(id: string): Promise<Result<void>> {
    try {
      await prisma.crmProposal.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete CRM proposal', error))
    }
  },

  async reorder(
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    try {
      await prisma.$transaction(
        orderedIds.map((id, position) =>
          prisma.crmProposal.update({
            where: { id, workspaceId },
            data: { position },
          }),
        ),
      )
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to reorder CRM proposals', error))
    }
  },
}

export const CrmProposalViewRepository = {
  async record(data: {
    proposalId: string
    viewId: string
    ipHash: string
    durationMs?: number
    reachedEnd?: boolean
    scrolledPct?: number
    referrer?: string
  }): Promise<Result<CrmProposalView>> {
    try {
      const view = await prisma.crmProposalView.upsert({
        where: {
          proposalId_viewId: {
            proposalId: data.proposalId,
            viewId: data.viewId,
          },
        },
        create: data,
        update: {
          durationMs: data.durationMs,
          reachedEnd: data.reachedEnd,
          scrolledPct: data.scrolledPct,
        },
      })
      return ok(view)
    } catch (error) {
      return err(dbError('Failed to record CRM proposal view', error))
    }
  },

  async listByProposal(proposalId: string): Promise<Result<CrmProposalView[]>> {
    try {
      const views = await prisma.crmProposalView.findMany({
        where: { proposalId },
        orderBy: { createdAt: 'desc' },
      })
      return ok(views)
    } catch (error) {
      return err(dbError('Failed to list CRM proposal views', error))
    }
  },

  /** Agregados de leitura + lista recente das visitas (cap de 200). */
  async metricsFor(proposalId: string): Promise<Result<CrmProposalMetricsRaw>> {
    try {
      const [agg, completed, uniques, views] = await Promise.all([
        prisma.crmProposalView.aggregate({
          where: { proposalId },
          _count: { _all: true },
          _avg: { durationMs: true },
        }),
        prisma.crmProposalView.count({
          where: { proposalId, reachedEnd: true },
        }),
        prisma.crmProposalView.groupBy({
          by: ['ipHash'],
          where: { proposalId },
        }),
        prisma.crmProposalView.findMany({
          where: { proposalId },
          orderBy: { createdAt: 'desc' },
          take: 200,
        }),
      ])
      return ok({
        totalViews: agg._count._all,
        uniqueVisitors: uniques.length,
        completed,
        avgDurationMs: Math.round(agg._avg.durationMs ?? 0),
        views,
      })
    } catch (error) {
      return err(dbError('Failed to compute CRM proposal metrics', error))
    }
  },
}
