import type {
  Prisma,
  SdDepartment,
  SdDepartmentMember,
  User,
} from '@prisma/client'
import { sdDepartmentNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import type { Result } from '@/src/lib/result'
import { sdDb, sdDbFind } from './sd-config-db'

export type SdDepartmentMemberWithUser = SdDepartmentMember & {
  user: Pick<User, 'id' | 'name' | 'email' | 'image'>
}

export type SdDepartmentWithMembers = SdDepartment & {
  members: SdDepartmentMemberWithUser[]
}

export interface SdDepartmentData {
  name?: string
  description?: string | null
  email?: string | null
  color?: string | null
  parentId?: string | null
  calendarId?: string | null
  active?: boolean
}

const include = {
  members: {
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: [{ isLead: 'desc' }, { createdAt: 'asc' }],
  },
} satisfies Prisma.SdDepartmentInclude

export const SdDepartmentRepository = {
  async list(
    workspaceId: string,
    options: { includeInactive?: boolean } = {},
  ): Promise<Result<SdDepartmentWithMembers[]>> {
    return sdDb('Failed to list ServiceDesk departments', () =>
      prisma.sdDepartment.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          ...(options.includeInactive ? {} : { active: true }),
        },
        include,
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
      }),
    )
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<SdDepartmentWithMembers>> {
    return sdDbFind(
      'Failed to find ServiceDesk department',
      () =>
        prisma.sdDepartment.findFirst({
          where: { id, workspaceId, deletedAt: null },
          include,
        }),
      sdDepartmentNotFound(),
    )
  },

  async countChildren(id: string): Promise<Result<number>> {
    return sdDb('Failed to count ServiceDesk sub-departments', () =>
      prisma.sdDepartment.count({ where: { parentId: id, deletedAt: null } }),
    )
  },

  async create(
    workspaceId: string,
    data: SdDepartmentData & { name: string },
  ): Promise<Result<SdDepartmentWithMembers>> {
    return sdDb('Failed to create ServiceDesk department', async () => {
      const position = await prisma.sdDepartment.count({
        where: {
          workspaceId,
          parentId: data.parentId ?? null,
          deletedAt: null,
        },
      })
      return prisma.sdDepartment.create({
        data: { ...data, workspaceId, position },
        include,
      })
    })
  },

  async update(
    id: string,
    workspaceId: string,
    data: SdDepartmentData,
  ): Promise<Result<SdDepartmentWithMembers>> {
    return sdDb('Failed to update ServiceDesk department', () =>
      prisma.sdDepartment.update({
        where: { id, workspaceId },
        data,
        include,
      }),
    )
  },

  /**
   * Exclusão lógica do departamento e dos sub-departamentos; limpa o
   * departamento padrão da configuração se apontava para um deles.
   */
  async softDelete(id: string, workspaceId: string): Promise<Result<void>> {
    return sdDb('Failed to delete ServiceDesk department', async () => {
      const deletedAt = new Date()
      await prisma.$transaction(async (tx) => {
        const children = await tx.sdDepartment.findMany({
          where: { parentId: id, workspaceId, deletedAt: null },
          select: { id: true },
        })
        const ids = [id, ...children.map((c) => c.id)]
        await tx.sdDepartment.updateMany({
          where: { id: { in: ids }, workspaceId },
          data: { deletedAt },
        })
        await tx.sdSettings.updateMany({
          where: { workspaceId, defaultDepartmentId: { in: ids } },
          data: { defaultDepartmentId: null },
        })
      })
    })
  },

  async reorder(
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    return sdDb('Failed to reorder ServiceDesk departments', async () => {
      await prisma.$transaction(
        orderedIds.map((id, position) =>
          prisma.sdDepartment.update({
            where: { id, workspaceId },
            data: { position },
          }),
        ),
      )
    })
  },

  async upsertMember(
    departmentId: string,
    userId: string,
    isLead: boolean,
  ): Promise<Result<void>> {
    return sdDb('Failed to add ServiceDesk department member', async () => {
      await prisma.sdDepartmentMember.upsert({
        where: { departmentId_userId: { departmentId, userId } },
        create: { departmentId, userId, isLead },
        update: { isLead },
      })
    })
  },

  async updateMember(
    departmentId: string,
    userId: string,
    isLead: boolean,
  ): Promise<Result<void>> {
    return sdDb('Failed to update ServiceDesk department member', async () => {
      await prisma.sdDepartmentMember.update({
        where: { departmentId_userId: { departmentId, userId } },
        data: { isLead },
      })
    })
  },

  async removeMember(
    departmentId: string,
    userId: string,
  ): Promise<Result<void>> {
    return sdDb('Failed to remove ServiceDesk department member', async () => {
      await prisma.sdDepartmentMember.delete({
        where: { departmentId_userId: { departmentId, userId } },
      })
    })
  },
}
