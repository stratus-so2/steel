import type { Prisma, SdCannedResponse } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { Result } from '@/src/lib/result'
import { sdDb, sdDbFind } from './sd-config-db'

export type SdCannedResponseWithAuthor = SdCannedResponse & {
  createdBy: { name: string } | null
}

export interface SdCannedResponseData {
  title?: string
  shortcut?: string | null
  body?: string
  departmentId?: string | null
}

const include = { createdBy: { select: { name: true } } } as const

export const SdCannedResponseRepository = {
  async list(
    workspaceId: string,
    options: { departmentId?: string; q?: string } = {},
  ): Promise<Result<SdCannedResponseWithAuthor[]>> {
    const and: Prisma.SdCannedResponseWhereInput[] = []
    if (options.departmentId) {
      and.push({
        OR: [{ departmentId: null }, { departmentId: options.departmentId }],
      })
    }
    if (options.q) {
      const contains = { contains: options.q, mode: 'insensitive' as const }
      and.push({
        OR: [{ title: contains }, { shortcut: contains }, { body: contains }],
      })
    }
    return sdDb('Failed to list ServiceDesk canned responses', () =>
      prisma.sdCannedResponse.findMany({
        where: { workspaceId, AND: and },
        include,
        orderBy: { title: 'asc' },
      }),
    )
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<SdCannedResponseWithAuthor>> {
    return sdDbFind('Failed to find ServiceDesk canned response', () =>
      prisma.sdCannedResponse.findFirst({
        where: { id, workspaceId },
        include,
      }),
    )
  },

  async create(
    workspaceId: string,
    createdById: string,
    data: SdCannedResponseData & { title: string; body: string },
  ): Promise<Result<SdCannedResponseWithAuthor>> {
    return sdDb('Failed to create ServiceDesk canned response', () =>
      prisma.sdCannedResponse.create({
        data: { ...data, workspaceId, createdById },
        include,
      }),
    )
  },

  async update(
    id: string,
    workspaceId: string,
    data: SdCannedResponseData,
  ): Promise<Result<SdCannedResponseWithAuthor>> {
    return sdDb('Failed to update ServiceDesk canned response', () =>
      prisma.sdCannedResponse.update({
        where: { id, workspaceId },
        data,
        include,
      }),
    )
  },

  async delete(id: string, workspaceId: string): Promise<Result<void>> {
    return sdDb('Failed to delete ServiceDesk canned response', async () => {
      await prisma.sdCannedResponse.delete({ where: { id, workspaceId } })
    })
  },
}
