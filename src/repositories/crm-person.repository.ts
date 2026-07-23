import type { CrmPerson } from '@prisma/client'
import { notFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const CrmPersonRepository = {
  async listByWorkspace(
    workspaceId: string,
    filters?: { companyId?: string },
  ): Promise<Result<CrmPerson[]>> {
    try {
      const people = await prisma.crmPerson.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          ...(filters?.companyId ? { companyId: filters.companyId } : {}),
        },
        orderBy: { position: 'asc' },
      })
      return ok(people)
    } catch (error) {
      return err(dbError('Failed to list CRM people', error))
    }
  },

  async findById(id: string, workspaceId: string): Promise<Result<CrmPerson>> {
    try {
      const person = await prisma.crmPerson.findFirst({
        where: { id, workspaceId, deletedAt: null },
      })

      if (!person) return err(notFound('CrmPerson'))

      return ok(person)
    } catch (error) {
      return err(dbError('Failed to find CRM person by id', error))
    }
  },

  async create(data: {
    workspaceId: string
    createdById: string
    name: string
    emails?: string[]
    phones?: string[]
    city?: string
    jobTitle?: string
    linkedin?: string
    avatar?: string
    companyId?: string
  }): Promise<Result<CrmPerson>> {
    try {
      const position = await prisma.crmPerson.count({
        where: { workspaceId: data.workspaceId, deletedAt: null },
      })

      const person = await prisma.crmPerson.create({
        data: { ...data, position },
      })
      return ok(person)
    } catch (error) {
      return err(dbError('Failed to create CRM person', error))
    }
  },

  async update(
    id: string,
    data: {
      name?: string
      emails?: string[]
      phones?: string[]
      city?: string
      jobTitle?: string
      linkedin?: string
      avatar?: string
      companyId?: string | null
      updatedById?: string
    },
  ): Promise<Result<CrmPerson>> {
    try {
      const person = await prisma.crmPerson.update({ where: { id }, data })
      return ok(person)
    } catch (error) {
      return err(dbError('Failed to update CRM person', error))
    }
  },

  async softDelete(id: string): Promise<Result<void>> {
    try {
      await prisma.crmPerson.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete CRM person', error))
    }
  },

  async reorder(
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    try {
      await prisma.$transaction(
        orderedIds.map((id, position) =>
          prisma.crmPerson.update({
            where: { id, workspaceId },
            data: { position },
          }),
        ),
      )
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to reorder CRM people', error))
    }
  },
}
