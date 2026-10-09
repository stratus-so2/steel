import type { WhatsAppConnection, WhatsAppTemplate } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

/**
 * Read-only lookups of the records a campaign points to (landing pages,
 * forms, e-mail templates, mailing lists, WhatsApp connections/templates),
 * always scoped to the campaign's workspace.
 */

export interface CampaignDestinationRecord {
  id: string
  token: string
  published: boolean
}

export const CrmCampaignLookupRepository = {
  async findLandingPage(
    workspaceId: string,
    id: string,
  ): Promise<Result<CampaignDestinationRecord | null>> {
    try {
      const page = await prisma.crmLandingPage.findFirst({
        where: { id, workspaceId, deletedAt: null },
        select: { id: true, shareToken: true, status: true },
      })
      return ok(
        page
          ? {
              id: page.id,
              token: page.shareToken,
              published: page.status === 'PUBLISHED',
            }
          : null,
      )
    } catch (error) {
      return err(dbError('Failed to find campaign landing page', error))
    }
  },

  async findForm(
    workspaceId: string,
    id: string,
  ): Promise<Result<CampaignDestinationRecord | null>> {
    try {
      const form = await prisma.crmForm.findFirst({
        where: { id, workspaceId, deletedAt: null },
        select: { id: true, publicToken: true, status: true },
      })
      return ok(
        form
          ? {
              id: form.id,
              token: form.publicToken,
              published: form.status === 'PUBLISHED',
            }
          : null,
      )
    } catch (error) {
      return err(dbError('Failed to find campaign form', error))
    }
  },

  async findEmailTemplate(
    workspaceId: string,
    id: string,
  ): Promise<Result<{ id: string; subject: string } | null>> {
    try {
      const template = await prisma.crmEmailTemplate.findFirst({
        where: { id, workspaceId, deletedAt: null },
        select: { id: true, subject: true },
      })
      return ok(template)
    } catch (error) {
      return err(dbError('Failed to find campaign e-mail template', error))
    }
  },

  /** Comunicação connection (module COMMUNICATION) of the workspace. */
  async findConnection(
    workspaceId: string,
    id: string,
  ): Promise<Result<WhatsAppConnection | null>> {
    try {
      const connection = await prisma.whatsAppConnection.findFirst({
        where: { id, workspaceId, module: 'COMMUNICATION' },
      })
      return ok(connection)
    } catch (error) {
      return err(dbError('Failed to find campaign WhatsApp connection', error))
    }
  },

  async findWhatsAppTemplate(
    workspaceId: string,
    connectionId: string,
    id: string,
  ): Promise<Result<WhatsAppTemplate | null>> {
    try {
      const template = await prisma.whatsAppTemplate.findFirst({
        where: { id, workspaceId, connectionId },
      })
      return ok(template)
    } catch (error) {
      return err(dbError('Failed to find campaign WhatsApp template', error))
    }
  },

  /** Destination tokens of many campaigns at once (list view links). */
  async destinationTokens(
    workspaceId: string,
    ids: { landingPageIds: string[]; formIds: string[] },
  ): Promise<Result<Map<string, string>>> {
    try {
      const [pages, forms] = await Promise.all([
        ids.landingPageIds.length
          ? prisma.crmLandingPage.findMany({
              where: { workspaceId, id: { in: ids.landingPageIds } },
              select: { id: true, shareToken: true },
            })
          : [],
        ids.formIds.length
          ? prisma.crmForm.findMany({
              where: { workspaceId, id: { in: ids.formIds } },
              select: { id: true, publicToken: true },
            })
          : [],
      ])
      const map = new Map<string, string>()
      for (const page of pages) map.set(page.id, page.shareToken)
      for (const form of forms) map.set(form.id, form.publicToken)
      return ok(map)
    } catch (error) {
      return err(dbError('Failed to read campaign destinations', error))
    }
  },

  /** Everything the wizard pickers list, in one round trip. */
  async listOptions(workspaceId: string): Promise<
    Result<{
      landingPages: {
        id: string
        title: string
        status: string
        shareToken: string
      }[]
      forms: { id: string; name: string; status: string; publicToken: string }[]
      emailTemplates: { id: string; name: string; subject: string }[]
      mailingLists: { id: string; name: string }[]
      connections: (WhatsAppConnection & { templates: WhatsAppTemplate[] })[]
    }>
  > {
    try {
      const [landingPages, forms, emailTemplates, mailingLists, connections] =
        await Promise.all([
          prisma.crmLandingPage.findMany({
            where: { workspaceId, deletedAt: null },
            select: { id: true, title: true, status: true, shareToken: true },
            orderBy: { updatedAt: 'desc' },
          }),
          prisma.crmForm.findMany({
            where: { workspaceId, deletedAt: null },
            select: { id: true, name: true, status: true, publicToken: true },
            orderBy: { updatedAt: 'desc' },
          }),
          prisma.crmEmailTemplate.findMany({
            where: { workspaceId, deletedAt: null },
            select: { id: true, name: true, subject: true },
            orderBy: { updatedAt: 'desc' },
          }),
          prisma.crmMailingList.findMany({
            where: { workspaceId, deletedAt: null },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
          }),
          prisma.whatsAppConnection.findMany({
            where: {
              workspaceId,
              module: 'COMMUNICATION',
              status: 'CONNECTED',
            },
            include: {
              templates: {
                where: { status: 'APPROVED' },
                orderBy: { name: 'asc' },
              },
            },
            orderBy: { createdAt: 'asc' },
          }),
        ])
      return ok({
        landingPages,
        forms,
        emailTemplates,
        mailingLists,
        connections,
      })
    } catch (error) {
      return err(dbError('Failed to list campaign options', error))
    }
  },

  /** `true` when every id is a live mailing list of the workspace. */
  async mailingListsExist(
    workspaceId: string,
    ids: string[],
  ): Promise<Result<boolean>> {
    if (ids.length === 0) return ok(true)
    try {
      const count = await prisma.crmMailingList.count({
        where: { workspaceId, deletedAt: null, id: { in: ids } },
      })
      return ok(count === new Set(ids).size)
    } catch (error) {
      return err(dbError('Failed to check campaign mailing lists', error))
    }
  },
}
