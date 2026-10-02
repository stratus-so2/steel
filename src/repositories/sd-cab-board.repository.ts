import type { Prisma, SdCabBoard, SdCabMember, User } from '@prisma/client'
import { sdCabBoardNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import type { Result } from '@/src/lib/result'
import type { SdCabMemberInput } from '@/src/schemas/sd-cab-board.schema'
import { sdDb, sdDbFind } from './sd-config-db'
import { SD_USER_SUMMARY_SELECT } from './sd-ticket.repository'

export type SdCabMemberWithUser = SdCabMember & {
  user: Pick<User, 'id' | 'name' | 'email' | 'image'> | null
}

export type SdCabBoardWithMembers = SdCabBoard & {
  members: SdCabMemberWithUser[]
}

export interface SdCabBoardData {
  name?: string
  description?: string | null
  quorum?: number
  rejectEnds?: boolean
  conditions?: Prisma.InputJsonValue
  active?: boolean
  position?: number
}

const include = {
  members: {
    include: { user: { select: SD_USER_SUMMARY_SELECT } },
    orderBy: [{ required: 'desc' }, { id: 'asc' }],
  },
} satisfies Prisma.SdCabBoardInclude

/** Comitês de mudança (`SdCabBoard` + `SdCabMember`). Só acesso. */
export const SdCabBoardRepository = {
  async list(
    workspaceId: string,
    options: { includeInactive?: boolean } = {},
  ): Promise<Result<SdCabBoardWithMembers[]>> {
    return sdDb('Failed to list ServiceDesk CAB boards', () =>
      prisma.sdCabBoard.findMany({
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
  ): Promise<Result<SdCabBoardWithMembers>> {
    return sdDbFind(
      'Failed to find ServiceDesk CAB board',
      () =>
        prisma.sdCabBoard.findFirst({
          where: { id, workspaceId, deletedAt: null },
          include,
        }),
      sdCabBoardNotFound(),
    )
  },

  async create(
    workspaceId: string,
    createdById: string,
    data: SdCabBoardData & { name: string; members: SdCabMemberInput[] },
  ): Promise<Result<SdCabBoardWithMembers>> {
    const { members, ...board } = data
    return sdDb('Failed to create ServiceDesk CAB board', async () => {
      const position =
        board.position ??
        (await prisma.sdCabBoard.count({
          where: { workspaceId, deletedAt: null },
        }))
      return prisma.sdCabBoard.create({
        data: {
          ...board,
          position,
          workspaceId,
          createdById,
          members: { create: members },
        },
        include,
      })
    })
  },

  /** Atualiza o comitê; `members` (quando vier) substitui a lista inteira. */
  async update(
    id: string,
    workspaceId: string,
    data: SdCabBoardData & { members?: SdCabMemberInput[] },
  ): Promise<Result<SdCabBoardWithMembers>> {
    const { members, ...board } = data
    return sdDb('Failed to update ServiceDesk CAB board', () =>
      prisma.$transaction(async (tx) => {
        if (members) {
          await tx.sdCabMember.deleteMany({ where: { boardId: id } })
        }
        return tx.sdCabBoard.update({
          where: { id, workspaceId },
          data: {
            ...board,
            ...(members ? { members: { create: members } } : {}),
          },
          include,
        })
      }),
    )
  },

  async softDelete(id: string, workspaceId: string): Promise<Result<void>> {
    return sdDb('Failed to delete ServiceDesk CAB board', async () => {
      await prisma.sdCabBoard.update({
        where: { id, workspaceId },
        data: { deletedAt: new Date(), active: false },
      })
    })
  },
}
