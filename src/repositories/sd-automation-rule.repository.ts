import type {
  Prisma,
  SdAutomationEvent,
  SdAutomationRule,
} from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { Result } from '@/src/lib/result'
import { sdDb, sdDbFind } from './sd-config-db'

export interface SdAutomationRuleData {
  name?: string
  description?: string | null
  event?: SdAutomationEvent
  conditions?: Prisma.InputJsonValue
  actions?: Prisma.InputJsonValue
  stopProcessing?: boolean
  active?: boolean
}

export const SdAutomationRuleRepository = {
  async list(
    workspaceId: string,
    options: { event?: SdAutomationEvent } = {},
  ): Promise<Result<SdAutomationRule[]>> {
    return sdDb('Failed to list ServiceDesk automation rules', () =>
      prisma.sdAutomationRule.findMany({
        where: {
          workspaceId,
          ...(options.event ? { event: options.event } : {}),
        },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
    )
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<SdAutomationRule>> {
    return sdDbFind('Failed to find ServiceDesk automation rule', () =>
      prisma.sdAutomationRule.findFirst({ where: { id, workspaceId } }),
    )
  },

  async create(
    workspaceId: string,
    data: SdAutomationRuleData & {
      name: string
      event: SdAutomationEvent
      actions: Prisma.InputJsonValue
    },
  ): Promise<Result<SdAutomationRule>> {
    return sdDb('Failed to create ServiceDesk automation rule', async () => {
      const position = await prisma.sdAutomationRule.count({
        where: { workspaceId },
      })
      return prisma.sdAutomationRule.create({
        data: { ...data, workspaceId, position },
      })
    })
  },

  async update(
    id: string,
    workspaceId: string,
    data: SdAutomationRuleData,
  ): Promise<Result<SdAutomationRule>> {
    return sdDb('Failed to update ServiceDesk automation rule', () =>
      prisma.sdAutomationRule.update({ where: { id, workspaceId }, data }),
    )
  },

  async delete(id: string, workspaceId: string): Promise<Result<void>> {
    return sdDb('Failed to delete ServiceDesk automation rule', async () => {
      await prisma.sdAutomationRule.delete({ where: { id, workspaceId } })
    })
  },

  async reorder(
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    return sdDb('Failed to reorder ServiceDesk automation rules', async () => {
      await prisma.$transaction(
        orderedIds.map((id, position) =>
          prisma.sdAutomationRule.update({
            where: { id, workspaceId },
            data: { position },
          }),
        ),
      )
    })
  },
}
