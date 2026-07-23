import type { CrmNote } from '@prisma/client'
import { notFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const CrmNoteRepository = {
  async listByWorkspace(
    workspaceId: string,
    filters?: { companyId?: string; personId?: string; opportunityId?: string },
  ): Promise<Result<CrmNote[]>> {
    try {
      const notes = await prisma.crmNote.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          ...(filters?.companyId ? { companyId: filters.companyId } : {}),
          ...(filters?.personId ? { personId: filters.personId } : {}),
          ...(filters?.opportunityId
            ? { opportunityId: filters.opportunityId }
            : {}),
        },
        orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      })
      return ok(notes)
    } catch (error) {
      return err(dbError('Failed to list CRM notes', error))
    }
  },

  async findById(id: string, workspaceId: string): Promise<Result<CrmNote>> {
    try {
      const note = await prisma.crmNote.findFirst({
        where: { id, workspaceId, deletedAt: null },
      })
      if (!note) return err(notFound('CrmNote'))
      return ok(note)
    } catch (error) {
      return err(dbError('Failed to find CRM note by id', error))
    }
  },

  async create(data: {
    workspaceId: string
    createdById: string
    title?: string
    body?: string
    companyId?: string
    personId?: string
    opportunityId?: string
  }): Promise<Result<CrmNote>> {
    try {
      const position = await prisma.crmNote.count({
        where: { workspaceId: data.workspaceId, deletedAt: null },
      })
      const note = await prisma.crmNote.create({ data: { ...data, position } })
      return ok(note)
    } catch (error) {
      return err(dbError('Failed to create CRM note', error))
    }
  },

  async update(
    id: string,
    data: {
      title?: string
      body?: string
      companyId?: string | null
      personId?: string | null
      opportunityId?: string | null
      updatedById?: string
    },
  ): Promise<Result<CrmNote>> {
    try {
      const note = await prisma.crmNote.update({ where: { id }, data })
      return ok(note)
    } catch (error) {
      return err(dbError('Failed to update CRM note', error))
    }
  },

  async softDelete(id: string): Promise<Result<void>> {
    try {
      await prisma.crmNote.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete CRM note', error))
    }
  },

  /** Reordena globalmente — usado pela grade genérica. */
  async reorder(
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    try {
      await prisma.$transaction(
        orderedIds.map((id, position) =>
          prisma.crmNote.update({
            where: { id, workspaceId },
            data: { position },
          }),
        ),
      )
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to reorder CRM notes', error))
    }
  },
}
