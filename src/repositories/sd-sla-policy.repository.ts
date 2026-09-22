import type {
  Prisma,
  SdSlaKind,
  SdSlaPolicy,
  SdSlaTarget,
} from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { Result } from '@/src/lib/result'
import type { SdSlaTargetInput } from '@/src/schemas/sd-sla-policy.schema'
import { sdDb, sdDbFind } from './sd-config-db'

export type SdSlaPolicyWithTargets = SdSlaPolicy & { targets: SdSlaTarget[] }

export interface SdSlaPolicyData {
  kind?: SdSlaKind
  name?: string
  description?: string | null
  calendarId?: string | null
  conditions?: Prisma.InputJsonValue
  isDefault?: boolean
  active?: boolean
}

const include = {
  targets: { orderBy: { firstResponseMinutes: 'asc' } },
} as const

/** Marca a política como padrão: desmarca as demais e sincroniza SdSettings. */
async function markDefault(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  id: string,
) {
  await tx.sdSlaPolicy.updateMany({
    where: { workspaceId, isDefault: true, id: { not: id } },
    data: { isDefault: false },
  })
  await tx.sdSlaPolicy.update({
    where: { id, workspaceId },
    data: { isDefault: true },
  })
  await tx.sdSettings.updateMany({
    where: { workspaceId },
    data: { defaultSlaPolicyId: id },
  })
}

export const SdSlaPolicyRepository = {
  async list(workspaceId: string): Promise<Result<SdSlaPolicyWithTargets[]>> {
    return sdDb('Failed to list ServiceDesk SLA policies', () =>
      prisma.sdSlaPolicy.findMany({
        where: { workspaceId },
        include,
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
    )
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<SdSlaPolicyWithTargets>> {
    return sdDbFind('Failed to find ServiceDesk SLA policy', () =>
      prisma.sdSlaPolicy.findFirst({ where: { id, workspaceId }, include }),
    )
  },

  async countDefaults(workspaceId: string): Promise<Result<number>> {
    return sdDb('Failed to count ServiceDesk default SLA policies', () =>
      prisma.sdSlaPolicy.count({ where: { workspaceId, isDefault: true } }),
    )
  },

  async create(
    workspaceId: string,
    data: SdSlaPolicyData & { name: string },
    targets: SdSlaTargetInput[],
  ): Promise<Result<SdSlaPolicyWithTargets>> {
    return sdDb('Failed to create ServiceDesk SLA policy', () =>
      prisma.$transaction(async (tx) => {
        const position = await tx.sdSlaPolicy.count({ where: { workspaceId } })
        const created = await tx.sdSlaPolicy.create({
          data: {
            ...data,
            isDefault: false,
            workspaceId,
            position,
            targets: { create: targets },
          },
        })
        if (data.isDefault) await markDefault(tx, workspaceId, created.id)
        return tx.sdSlaPolicy.findUniqueOrThrow({
          where: { id: created.id },
          include,
        })
      }),
    )
  },

  /** Atualiza; `targets` (quando enviado) substitui todas as metas. */
  async update(
    id: string,
    workspaceId: string,
    data: SdSlaPolicyData,
    targets?: SdSlaTargetInput[],
  ): Promise<Result<SdSlaPolicyWithTargets>> {
    return sdDb('Failed to update ServiceDesk SLA policy', () =>
      prisma.$transaction(async (tx) => {
        const { isDefault, ...rest } = data
        await tx.sdSlaPolicy.update({
          where: { id, workspaceId },
          data: { ...rest, ...(isDefault === false && { isDefault: false }) },
        })
        if (isDefault) await markDefault(tx, workspaceId, id)
        if (targets) {
          await tx.sdSlaTarget.deleteMany({ where: { policyId: id } })
          await tx.sdSlaTarget.createMany({
            data: targets.map((t) => ({ ...t, policyId: id })),
          })
        }
        return tx.sdSlaPolicy.findUniqueOrThrow({ where: { id }, include })
      }),
    )
  },

  async setDefault(workspaceId: string, id: string): Promise<Result<void>> {
    return sdDb('Failed to set ServiceDesk default SLA policy', () =>
      prisma.$transaction((tx) => markDefault(tx, workspaceId, id)),
    )
  },

  async delete(id: string, workspaceId: string): Promise<Result<void>> {
    return sdDb('Failed to delete ServiceDesk SLA policy', async () => {
      await prisma.sdSlaPolicy.delete({ where: { id, workspaceId } })
    })
  },

  async reorder(
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    return sdDb('Failed to reorder ServiceDesk SLA policies', async () => {
      await prisma.$transaction(
        orderedIds.map((id, position) =>
          prisma.sdSlaPolicy.update({
            where: { id, workspaceId },
            data: { position },
          }),
        ),
      )
    })
  },
}
