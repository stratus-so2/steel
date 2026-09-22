import type {
  Prisma,
  SdPhase,
  SdPhaseCategory,
  SdPhaseTransition,
  SdTicketType,
} from '@prisma/client'
import { sdPhaseNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import type { Result } from '@/src/lib/result'
import { sdDb, sdDbFind } from './sd-config-db'

export interface SdPhaseData {
  name?: string
  description?: string | null
  color?: string | null
  category?: SdPhaseCategory
  completionPercent?: number
  isInitial?: boolean
  pausesSla?: boolean
  requiresApproval?: boolean
  requiredFields?: string[]
  wipLimit?: number
  active?: boolean
}

async function unsetOtherInitials(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  ticketType: SdTicketType,
  keepId: string,
) {
  await tx.sdPhase.updateMany({
    where: { workspaceId, ticketType, isInitial: true, id: { not: keepId } },
    data: { isInitial: false },
  })
}

export const SdPhaseRepository = {
  async list(
    workspaceId: string,
    options: { ticketType?: SdTicketType; includeInactive?: boolean } = {},
  ): Promise<Result<SdPhase[]>> {
    return sdDb('Failed to list ServiceDesk phases', () =>
      prisma.sdPhase.findMany({
        where: {
          workspaceId,
          ...(options.ticketType ? { ticketType: options.ticketType } : {}),
          ...(options.includeInactive ? {} : { active: true }),
        },
        orderBy: [{ ticketType: 'asc' }, { position: 'asc' }],
      }),
    )
  },

  async findById(id: string, workspaceId: string): Promise<Result<SdPhase>> {
    return sdDbFind(
      'Failed to find ServiceDesk phase',
      () => prisma.sdPhase.findFirst({ where: { id, workspaceId } }),
      sdPhaseNotFound(),
    )
  },

  async countInitial(
    workspaceId: string,
    ticketType: SdTicketType,
  ): Promise<Result<number>> {
    return sdDb('Failed to count ServiceDesk initial phases', () =>
      prisma.sdPhase.count({
        where: { workspaceId, ticketType, isInitial: true },
      }),
    )
  },

  /** Chamados (inclusive excluídos logicamente) presos à fase. */
  async countTickets(phaseId: string): Promise<Result<number>> {
    return sdDb('Failed to count ServiceDesk tickets in phase', () =>
      prisma.sdTicket.count({ where: { phaseId } }),
    )
  },

  async create(
    workspaceId: string,
    data: SdPhaseData & {
      ticketType: SdTicketType
      name: string
      category: SdPhaseCategory
    },
  ): Promise<Result<SdPhase>> {
    return sdDb('Failed to create ServiceDesk phase', () =>
      prisma.$transaction(async (tx) => {
        const position = await tx.sdPhase.count({
          where: { workspaceId, ticketType: data.ticketType },
        })
        const created = await tx.sdPhase.create({
          data: { ...data, workspaceId, position },
        })
        if (created.isInitial) {
          await unsetOtherInitials(
            tx,
            workspaceId,
            created.ticketType,
            created.id,
          )
        }
        return created
      }),
    )
  },

  /** Atualiza; `isInitial: true` desmarca as demais fases do mesmo tipo. */
  async update(
    id: string,
    workspaceId: string,
    data: SdPhaseData,
  ): Promise<Result<SdPhase>> {
    return sdDb('Failed to update ServiceDesk phase', () =>
      prisma.$transaction(async (tx) => {
        const updated = await tx.sdPhase.update({
          where: { id, workspaceId },
          data,
        })
        if (data.isInitial) {
          await unsetOtherInitials(tx, workspaceId, updated.ticketType, id)
        }
        return updated
      }),
    )
  },

  async delete(id: string, workspaceId: string): Promise<Result<void>> {
    return sdDb('Failed to delete ServiceDesk phase', async () => {
      await prisma.sdPhase.delete({ where: { id, workspaceId } })
    })
  },

  async reorder(
    workspaceId: string,
    ticketType: SdTicketType,
    orderedIds: string[],
  ): Promise<Result<void>> {
    return sdDb('Failed to reorder ServiceDesk phases', async () => {
      await prisma.$transaction(
        orderedIds.map((id, position) =>
          prisma.sdPhase.update({
            where: { id, workspaceId, ticketType },
            data: { position },
          }),
        ),
      )
    })
  },

  async listTransitions(
    workspaceId: string,
    ticketType?: SdTicketType,
  ): Promise<Result<SdPhaseTransition[]>> {
    return sdDb('Failed to list ServiceDesk phase transitions', () =>
      prisma.sdPhaseTransition.findMany({
        where: {
          workspaceId,
          ...(ticketType ? { fromPhase: { ticketType } } : {}),
        },
        orderBy: { createdAt: 'asc' },
      }),
    )
  },

  /** Substitui todas as transições do tipo. */
  async saveTransitions(
    workspaceId: string,
    ticketType: SdTicketType,
    transitions: {
      fromPhaseId: string
      toPhaseId: string
      allowedDepartmentIds: string[]
    }[],
  ): Promise<Result<SdPhaseTransition[]>> {
    return sdDb('Failed to save ServiceDesk phase transitions', () =>
      prisma.$transaction(async (tx) => {
        await tx.sdPhaseTransition.deleteMany({
          where: { workspaceId, fromPhase: { ticketType } },
        })
        await tx.sdPhaseTransition.createMany({
          data: transitions.map((t) => ({ ...t, workspaceId })),
        })
        return tx.sdPhaseTransition.findMany({
          where: { workspaceId, fromPhase: { ticketType } },
          orderBy: { createdAt: 'asc' },
        })
      }),
    )
  },
}
