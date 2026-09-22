import type { Prisma, SdPriorityMatrix } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { Result } from '@/src/lib/result'
import type { SdScaleKind } from '@/src/schemas/sd-priority.schema'
import { sdDb, sdDbFind } from './sd-config-db'

/** Linha comum às quatro escalas (campos ausentes na tabela ficam `undefined`). */
export interface SdScaleRow {
  id: string
  workspaceId: string
  name: string
  level: number
  description?: string | null
  color?: string | null
  isDefault?: boolean
  createdAt: Date
  updatedAt: Date
}

export interface SdScaleData {
  name?: string
  description?: string | null
  color?: string | null
  level?: number
  isDefault?: boolean
}

interface ScaleDelegate {
  findMany(args: {
    where: Record<string, unknown>
    orderBy: Record<string, unknown>
  }): Promise<SdScaleRow[]>
  findFirst(args: {
    where: Record<string, unknown>
  }): Promise<SdScaleRow | null>
  create(args: { data: Record<string, unknown> }): Promise<SdScaleRow>
  update(args: {
    where: Record<string, unknown>
    data: Record<string, unknown>
  }): Promise<SdScaleRow>
  delete(args: { where: Record<string, unknown> }): Promise<SdScaleRow>
  count(args: { where: Record<string, unknown> }): Promise<number>
}

function delegate(
  client: Prisma.TransactionClient,
  kind: SdScaleKind,
): ScaleDelegate {
  const delegates = {
    impact: client.sdImpact,
    urgency: client.sdUrgency,
    priority: client.sdPriority,
    severity: client.sdSeverity,
  }
  return delegates[kind] as unknown as ScaleDelegate
}

/** Só as colunas que a tabela da escala tem. */
function columns(
  kind: SdScaleKind,
  data: SdScaleData,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (data.name !== undefined) out.name = data.name
  if (data.level !== undefined) out.level = data.level
  if (kind !== 'priority' && data.description !== undefined) {
    out.description = data.description
  }
  if (
    (kind === 'priority' || kind === 'severity') &&
    data.color !== undefined
  ) {
    out.color = data.color
  }
  if (kind === 'priority' && data.isDefault !== undefined) {
    out.isDefault = data.isDefault
  }
  return out
}

const LEVEL_CONFLICT = 'Já existe um item com este nível'

export const SdPriorityRepository = {
  async list(
    kind: SdScaleKind,
    workspaceId: string,
  ): Promise<Result<SdScaleRow[]>> {
    return sdDb(`Failed to list ServiceDesk ${kind} scale`, () =>
      delegate(prisma, kind).findMany({
        where: { workspaceId },
        orderBy: { level: 'asc' },
      }),
    )
  },

  async findById(
    kind: SdScaleKind,
    id: string,
    workspaceId: string,
  ): Promise<Result<SdScaleRow>> {
    return sdDbFind(`Failed to find ServiceDesk ${kind}`, () =>
      delegate(prisma, kind).findFirst({ where: { id, workspaceId } }),
    )
  },

  async count(kind: SdScaleKind, workspaceId: string): Promise<Result<number>> {
    return sdDb(`Failed to count ServiceDesk ${kind} scale`, () =>
      delegate(prisma, kind).count({ where: { workspaceId } }),
    )
  },

  /** Cria; prioridade `isDefault` desmarca as demais na mesma transação. */
  async create(
    kind: SdScaleKind,
    workspaceId: string,
    data: SdScaleData & { name: string; level: number },
  ): Promise<Result<SdScaleRow>> {
    return sdDb(
      `Failed to create ServiceDesk ${kind}`,
      () =>
        prisma.$transaction(async (tx) => {
          const created = await delegate(tx, kind).create({
            data: { ...columns(kind, data), workspaceId },
          })
          if (kind === 'priority' && data.isDefault) {
            await tx.sdPriority.updateMany({
              where: { workspaceId, id: { not: created.id } },
              data: { isDefault: false },
            })
          }
          return created
        }),
      LEVEL_CONFLICT,
    )
  },

  async update(
    kind: SdScaleKind,
    id: string,
    workspaceId: string,
    data: SdScaleData,
  ): Promise<Result<SdScaleRow>> {
    return sdDb(
      `Failed to update ServiceDesk ${kind}`,
      () =>
        prisma.$transaction(async (tx) => {
          const updated = await delegate(tx, kind).update({
            where: { id, workspaceId },
            data: columns(kind, data),
          })
          if (kind === 'priority' && data.isDefault) {
            await tx.sdPriority.updateMany({
              where: { workspaceId, id: { not: id } },
              data: { isDefault: false },
            })
          }
          return updated
        }),
      LEVEL_CONFLICT,
    )
  },

  async delete(
    kind: SdScaleKind,
    id: string,
    workspaceId: string,
  ): Promise<Result<void>> {
    return sdDb(`Failed to delete ServiceDesk ${kind}`, async () => {
      await delegate(prisma, kind).delete({ where: { id, workspaceId } })
    })
  },

  async listMatrix(workspaceId: string): Promise<Result<SdPriorityMatrix[]>> {
    return sdDb('Failed to list ServiceDesk priority matrix', () =>
      prisma.sdPriorityMatrix.findMany({ where: { workspaceId } }),
    )
  },

  /** Substitui a grade inteira. */
  async saveMatrix(
    workspaceId: string,
    cells: { impactId: string; urgencyId: string; priorityId: string }[],
  ): Promise<Result<SdPriorityMatrix[]>> {
    return sdDb('Failed to save ServiceDesk priority matrix', () =>
      prisma.$transaction(async (tx) => {
        await tx.sdPriorityMatrix.deleteMany({ where: { workspaceId } })
        await tx.sdPriorityMatrix.createMany({
          data: cells.map((c) => ({ ...c, workspaceId })),
        })
        return tx.sdPriorityMatrix.findMany({ where: { workspaceId } })
      }),
    )
  },
}
