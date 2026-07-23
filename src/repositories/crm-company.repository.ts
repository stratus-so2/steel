import type { CrmCompany, Prisma } from '@prisma/client'
import { crmCompanyConflict, notFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const CrmCompanyRepository = {
  async listByWorkspace(
    workspaceId: string,
    filters?: { icp?: boolean },
  ): Promise<Result<CrmCompany[]>> {
    try {
      const companies = await prisma.crmCompany.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          ...(filters?.icp !== undefined ? { icp: filters.icp } : {}),
        },
        orderBy: { position: 'asc' },
      })
      return ok(companies)
    } catch (error) {
      return err(dbError('Failed to list CRM companies', error))
    }
  },

  async findById(id: string, workspaceId: string): Promise<Result<CrmCompany>> {
    try {
      const company = await prisma.crmCompany.findFirst({
        where: { id, workspaceId, deletedAt: null },
      })

      if (!company) return err(notFound('CrmCompany'))

      return ok(company)
    } catch (error) {
      return err(dbError('Failed to find CRM company by id', error))
    }
  },

  async create(data: {
    workspaceId: string
    createdById: string
    name: string
    cnpj?: string
    domain?: string
    employees?: number
    linkedin?: string
    address?: Prisma.InputJsonValue
    arr?: number
    icp?: boolean
    accountOwnerId?: string
  }): Promise<Result<CrmCompany>> {
    try {
      const position = await prisma.crmCompany.count({
        where: { workspaceId: data.workspaceId, deletedAt: null },
      })

      const company = await prisma.crmCompany.create({
        data: { ...data, position },
      })
      return ok(company)
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        return err(crmCompanyConflict())
      }
      return err(dbError('Failed to create CRM company', error))
    }
  },

  async update(
    id: string,
    data: {
      name?: string
      cnpj?: string
      domain?: string
      employees?: number
      linkedin?: string
      address?: Prisma.InputJsonValue
      arr?: number
      icp?: boolean
      accountOwnerId?: string | null
      updatedById?: string
    },
  ): Promise<Result<CrmCompany>> {
    try {
      const company = await prisma.crmCompany.update({ where: { id }, data })
      return ok(company)
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        return err(crmCompanyConflict())
      }
      return err(dbError('Failed to update CRM company', error))
    }
  },

  async softDelete(id: string): Promise<Result<void>> {
    try {
      await prisma.crmCompany.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete CRM company', error))
    }
  },

  async reorder(
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    try {
      await prisma.$transaction(
        orderedIds.map((id, position) =>
          prisma.crmCompany.update({
            where: { id, workspaceId },
            data: { position },
          }),
        ),
      )
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to reorder CRM companies', error))
    }
  },
}
