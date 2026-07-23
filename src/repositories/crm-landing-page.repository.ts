import { createId } from '@paralleldrive/cuid2'
import type { CrmLandingPage, CrmLandingPageView } from '@prisma/client'
import { notFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const CrmLandingPageRepository = {
  async listByWorkspace(
    workspaceId: string,
  ): Promise<Result<CrmLandingPage[]>> {
    try {
      const pages = await prisma.crmLandingPage.findMany({
        where: { workspaceId, deletedAt: null },
        orderBy: { position: 'asc' },
      })
      return ok(pages)
    } catch (error) {
      return err(dbError('Failed to list CRM landing pages', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<CrmLandingPage>> {
    try {
      const page = await prisma.crmLandingPage.findFirst({
        where: { id, workspaceId, deletedAt: null },
      })
      if (!page) return err(notFound('CrmLandingPage'))
      return ok(page)
    } catch (error) {
      return err(dbError('Failed to find CRM landing page by id', error))
    }
  },

  async findByShareToken(shareToken: string): Promise<Result<CrmLandingPage>> {
    try {
      const page = await prisma.crmLandingPage.findFirst({
        where: { shareToken, status: 'PUBLISHED', deletedAt: null },
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
    html?: string
  }): Promise<Result<CrmLandingPage>> {
    try {
      const position = await prisma.crmLandingPage.count({
        where: { workspaceId: data.workspaceId, deletedAt: null },
      })
      const page = await prisma.crmLandingPage.create({
        data: { ...data, shareToken: createId(), position },
      })
      return ok(page)
    } catch (error) {
      return err(dbError('Failed to create CRM landing page', error))
    }
  },

  async update(
    id: string,
    data: { title?: string; html?: string; updatedById?: string },
  ): Promise<Result<CrmLandingPage>> {
    try {
      const page = await prisma.crmLandingPage.update({ where: { id }, data })
      return ok(page)
    } catch (error) {
      return err(dbError('Failed to update CRM landing page', error))
    }
  },

  async setPublished(
    id: string,
    published: boolean,
  ): Promise<Result<CrmLandingPage>> {
    try {
      const page = await prisma.crmLandingPage.update({
        where: { id },
        data: {
          status: published ? 'PUBLISHED' : 'DRAFT',
          publishedAt: published ? new Date() : null,
        },
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
