import { createId } from '@paralleldrive/cuid2'
import type {
  CrmLandingPage,
  CrmLandingPageSection,
  CrmLandingPageView,
  Prisma,
} from '@prisma/client'
import { notFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import type { CrmLandingPageSectionInputDTO } from '@/src/schemas/crm-landing-page-section.schema'
import { dbError } from './db-error'

export type CrmLandingPageWithSections = CrmLandingPage & {
  sections: CrmLandingPageSection[]
}

function toSectionCreateInput(
  sections: CrmLandingPageSectionInputDTO[],
): Prisma.CrmLandingPageSectionCreateManyLandingPageInput[] {
  return sections.map((section) => ({
    type: section.type,
    order: section.order,
    enabled: section.enabled,
    content: section.content as unknown as Prisma.InputJsonValue,
  }))
}

export const CrmLandingPageRepository = {
  async listByWorkspace(
    workspaceId: string,
  ): Promise<Result<(CrmLandingPage & { _count: { views: number } })[]>> {
    try {
      const pages = await prisma.crmLandingPage.findMany({
        where: { workspaceId, deletedAt: null },
        orderBy: { position: 'asc' },
        include: { _count: { select: { views: true } } },
      })
      return ok(pages)
    } catch (error) {
      return err(dbError('Failed to list CRM landing pages', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<CrmLandingPageWithSections>> {
    try {
      const page = await prisma.crmLandingPage.findFirst({
        where: { id, workspaceId, deletedAt: null },
        include: { sections: { orderBy: { order: 'asc' } } },
      })
      if (!page) return err(notFound('CrmLandingPage'))
      return ok(page)
    } catch (error) {
      return err(dbError('Failed to find CRM landing page by id', error))
    }
  },

  async findByShareToken(
    shareToken: string,
  ): Promise<Result<CrmLandingPageWithSections>> {
    try {
      const page = await prisma.crmLandingPage.findFirst({
        where: { shareToken, status: 'PUBLISHED', deletedAt: null },
        include: { sections: { orderBy: { order: 'asc' } } },
      })
      if (!page) return err(notFound('CrmLandingPage'))
      return ok(page)
    } catch (error) {
      return err(
        dbError('Failed to find CRM landing page by share token', error),
      )
    }
  },

  async create(data: {
    workspaceId: string
    createdById: string
    title: string
    templateKey: string
    sections: CrmLandingPageSectionInputDTO[]
  }): Promise<Result<CrmLandingPageWithSections>> {
    try {
      const position = await prisma.crmLandingPage.count({
        where: { workspaceId: data.workspaceId, deletedAt: null },
      })
      const page = await prisma.crmLandingPage.create({
        data: {
          workspaceId: data.workspaceId,
          createdById: data.createdById,
          title: data.title,
          templateKey: data.templateKey,
          shareToken: createId(),
          position,
          sections: {
            createMany: { data: toSectionCreateInput(data.sections) },
          },
        },
        include: { sections: { orderBy: { order: 'asc' } } },
      })
      return ok(page)
    } catch (error) {
      return err(dbError('Failed to create CRM landing page', error))
    }
  },

  async update(
    id: string,
    data: {
      title?: string
      status?: 'DRAFT' | 'PUBLISHED'
      publishedAt?: Date
      updatedById?: string
      sections?: CrmLandingPageSectionInputDTO[]
    },
  ): Promise<Result<CrmLandingPageWithSections>> {
    try {
      const { sections, ...rest } = data
      const page = await prisma.$transaction(async (tx) => {
        if (sections) {
          await tx.crmLandingPageSection.deleteMany({
            where: { landingPageId: id },
          })
        }
        return tx.crmLandingPage.update({
          where: { id },
          data: {
            ...rest,
            ...(sections && {
              sections: {
                createMany: { data: toSectionCreateInput(sections) },
              },
            }),
          },
          include: { sections: { orderBy: { order: 'asc' } } },
        })
      })
      return ok(page)
    } catch (error) {
      return err(dbError('Failed to update CRM landing page', error))
    }
  },

  async setPublished(
    id: string,
    published: boolean,
  ): Promise<Result<CrmLandingPageWithSections>> {
    try {
      const page = await prisma.crmLandingPage.update({
        where: { id },
        data: {
          status: published ? 'PUBLISHED' : 'DRAFT',
          publishedAt: published ? new Date() : null,
        },
        include: { sections: { orderBy: { order: 'asc' } } },
      })
      return ok(page)
    } catch (error) {
      return err(dbError('Failed to publish CRM landing page', error))
    }
  },

  async softDelete(id: string): Promise<Result<void>> {
    try {
      await prisma.crmLandingPage.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete CRM landing page', error))
    }
  },

  async reorder(
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    try {
      await prisma.$transaction(
        orderedIds.map((id, position) =>
          prisma.crmLandingPage.update({
            where: { id, workspaceId },
            data: { position },
          }),
        ),
      )
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to reorder CRM landing pages', error))
    }
  },
}

export const CrmLandingPageViewRepository = {
  async record(data: {
    landingPageId: string
    viewId: string
    ipHash: string
    durationMs?: number
    ctaClicks?: number
    referrer?: string
  }): Promise<Result<CrmLandingPageView>> {
    try {
      const view = await prisma.crmLandingPageView.upsert({
        where: {
          landingPageId_viewId: {
            landingPageId: data.landingPageId,
            viewId: data.viewId,
          },
        },
        create: data,
        update: {
          durationMs: data.durationMs,
          ctaClicks: data.ctaClicks,
        },
      })
      return ok(view)
    } catch (error) {
      return err(dbError('Failed to record CRM landing page view', error))
    }
  },

  async listByLandingPage(
    landingPageId: string,
  ): Promise<Result<CrmLandingPageView[]>> {
    try {
      const views = await prisma.crmLandingPageView.findMany({
        where: { landingPageId },
        orderBy: { createdAt: 'desc' },
      })
      return ok(views)
    } catch (error) {
      return err(dbError('Failed to list CRM landing page views', error))
    }
  },
}
