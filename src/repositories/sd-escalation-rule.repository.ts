import type {
  Prisma,
  SdEscalationRule,
  SdEscalationTrigger,
} from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { Result } from '@/src/lib/result'
import { sdDb, sdDbFind } from './sd-config-db'

export interface SdEscalationRuleData {
  name?: string
  trigger?: SdEscalationTrigger
  thresholdMinutes?: number | null
  conditions?: Prisma.InputJsonValue
  actions?: Prisma.InputJsonValue
  active?: boolean
}

export const SdEscalationRuleRepository = {
  async list(workspaceId: string): Promise<Result<SdEscalationRule[]>> {
    return sdDb('Failed to list ServiceDesk escalation rules', () =>
      prisma.sdEscalationRule.findMany({
        where: { workspaceId },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
    )
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<SdEscalationRule>> {
    return sdDbFind('Failed to find ServiceDesk escalation rule', () =>
      prisma.sdEscalationRule.findFirst({ where: { id, workspaceId } }),
    )
  },

  async create(
    workspaceId: string,
    data: SdEscalationRuleData & {
      name: string
      trigger: SdEscalationTrigger
      actions: Prisma.InputJsonValue
    },
  ): Promise<Result<SdEscalationRule>> {
    return sdDb('Failed to create ServiceDesk escalation rule', async () => {
      const position = await prisma.sdEscalationRule.count({
        where: { workspaceId },
      })
      return prisma.sdEscalationRule.create({
        data: { ...data, workspaceId, position },
      })
    })
  },

  async update(
    id: string,
    workspaceId: string,
    data: SdEscalationRuleData,
  ): Promise<Result<SdEscalationRule>> {
    return sdDb('Failed to update ServiceDesk escalation rule', () =>
      prisma.sdEscalationRule.update({ where: { id, workspaceId }, data }),
    )
  },

  async delete(id: string, workspaceId: string): Promise<Result<void>> {
    return sdDb('Failed to delete ServiceDesk escalation rule', async () => {
      await prisma.sdEscalationRule.delete({ where: { id, workspaceId } })
    })
  },

  async reorder(
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    return sdDb('Failed to reorder ServiceDesk escalation rules', async () => {
      await prisma.$transaction(
        orderedIds.map((id, position) =>
          prisma.sdEscalationRule.update({
            where: { id, workspaceId },
            data: { position },
          }),
        ),
      )
    })
  },
}
