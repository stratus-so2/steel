import type {
  CrmProposalTemplate,
  CrmProposalTemplateSection,
  Prisma,
} from '@prisma/client'
import { crmProposalTemplateNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export type CrmProposalTemplateWithSections = CrmProposalTemplate & {
  sections: CrmProposalTemplateSection[]
}

export type CrmProposalTemplateSectionInput = {
  type: CrmProposalTemplateSection['type']
  order: number
  enabled: boolean
  defaultContent?: unknown
}

function toSectionCreateInput(
  sections: CrmProposalTemplateSectionInput[],
): Prisma.CrmProposalTemplateSectionCreateManyTemplateInput[] {
  return sections.map((section) => ({
    type: section.type,
    order: section.order,
    enabled: section.enabled,
    defaultContent: section.defaultContent as Prisma.InputJsonValue | undefined,
  }))
}

export const CrmProposalTemplateRepository = {
  async listByWorkspace(
    workspaceId: string,
  ): Promise<Result<CrmProposalTemplate[]>> {
    try {
      const templates = await prisma.crmProposalTemplate.findMany({
        where: { workspaceId, deletedAt: null },
        orderBy: { position: 'asc' },
      })
      return ok(templates)
    } catch (error) {
      return err(dbError('Failed to list CRM proposal templates', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<CrmProposalTemplateWithSections>> {
    try {
      const template = await prisma.crmProposalTemplate.findFirst({
        where: { id, workspaceId, deletedAt: null },
        include: { sections: { orderBy: { order: 'asc' } } },
      })
      if (!template) return err(crmProposalTemplateNotFound())
      return ok(template)
    } catch (error) {
      return err(dbError('Failed to find CRM proposal template by id', error))
    }
  },

  async create(data: {
    workspaceId: string
    createdById: string
    name: string
    description?: string
    logoUrl?: string
    sections: CrmProposalTemplateSectionInput[]
  }): Promise<Result<CrmProposalTemplateWithSections>> {
    try {
      const position = await prisma.crmProposalTemplate.count({
        where: { workspaceId: data.workspaceId, deletedAt: null },
      })
      const template = await prisma.crmProposalTemplate.create({
        data: {
          workspaceId: data.workspaceId,
          createdById: data.createdById,
          name: data.name,
          description: data.description,
          logoUrl: data.logoUrl,
          position,
          sections: {
            createMany: { data: toSectionCreateInput(data.sections) },
          },
        },
        include: { sections: { orderBy: { order: 'asc' } } },
      })
      return ok(template)
    } catch (error) {
      return err(dbError('Failed to create CRM proposal template', error))
    }
  },

  async update(
    id: string,
    data: {
      name?: string
      description?: string | null
      logoUrl?: string | null
      updatedById?: string
      sections?: CrmProposalTemplateSectionInput[]
    },
  ): Promise<Result<CrmProposalTemplateWithSections>> {
    try {
      const { sections, ...rest } = data
      const template = await prisma.$transaction(async (tx) => {
        if (sections) {
          await tx.crmProposalTemplateSection.deleteMany({
            where: { templateId: id },
          })
        }
        return tx.crmProposalTemplate.update({
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
      return ok(template)
    } catch (error) {
      return err(dbError('Failed to update CRM proposal template', error))
    }
  },

  async softDelete(id: string): Promise<Result<void>> {
    try {
      await prisma.crmProposalTemplate.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete CRM proposal template', error))
    }
  },
}
