import { Prisma } from '@prisma/client'
import { sdChangeWindowNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import type { Result } from '@/src/lib/result'
import { sdDb, sdDbFind } from './sd-config-db'
import { SD_USER_SUMMARY_SELECT } from './sd-ticket.repository'

export interface SdChangeWindowData {
  name?: string
  kind?: 'MAINTENANCE' | 'FREEZE'
  startsAt?: Date
  endsAt?: Date
  /** `Prisma.DbNull` limpa a recorrência (coluna Json anulável). */
  recurrence?: Prisma.InputJsonValue | typeof Prisma.DbNull
  timezone?: string
  configItemIds?: string[]
  departmentIds?: string[]
  description?: string | null
}

const include = {
  createdBy: { select: SD_USER_SUMMARY_SELECT },
} as const satisfies Prisma.SdChangeWindowInclude

export type SdChangeWindowWithAuthor = Prisma.SdChangeWindowGetPayload<{
  include: typeof include
}>

/**
 * Janelas do calendário de mudanças (`SdChangeWindow`). Só acesso: a
 * validação do período e a expansão da recorrência moram no service e na lib
 * `src/lib/servicedesk/change-calendar.ts`.
 */
export const SdChangeWindowRepository = {
  async list(
    workspaceId: string,
    options: { kind?: 'MAINTENANCE' | 'FREEZE' } = {},
  ): Promise<Result<SdChangeWindowWithAuthor[]>> {
    return sdDb('Failed to list ServiceDesk change windows', () =>
      prisma.sdChangeWindow.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          ...(options.kind ? { kind: options.kind } : {}),
        },
        include,
        orderBy: [{ startsAt: 'asc' }, { name: 'asc' }],
      }),
    )
  },

  /**
   * Candidatas a aparecer no intervalo `[from, to)`: as que começam antes de
   * `to` e ou terminam depois de `from` ou têm recorrência (a expansão é que
   * decide). Recorrência aberta não tem fim no banco, então não é possível
   * filtrar mais que isso em SQL.
   */
  async listForRange(
    workspaceId: string,
    range: { from: Date; to: Date },
    options: { kind?: 'MAINTENANCE' | 'FREEZE' } = {},
  ): Promise<Result<SdChangeWindowWithAuthor[]>> {
    return sdDb('Failed to list ServiceDesk change windows', () =>
      prisma.sdChangeWindow.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          startsAt: { lt: range.to },
          ...(options.kind ? { kind: options.kind } : {}),
          OR: [
            { endsAt: { gt: range.from } },
            { recurrence: { not: Prisma.DbNull } },
          ],
        },
        include,
        orderBy: [{ startsAt: 'asc' }, { name: 'asc' }],
      }),
    )
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<SdChangeWindowWithAuthor>> {
    return sdDbFind(
      'Failed to find ServiceDesk change window',
      () =>
        prisma.sdChangeWindow.findFirst({
          where: { id, workspaceId, deletedAt: null },
          include,
        }),
      sdChangeWindowNotFound(),
    )
  },

  async create(
    workspaceId: string,
    createdById: string,
    data: SdChangeWindowData & { name: string; startsAt: Date; endsAt: Date },
  ): Promise<Result<SdChangeWindowWithAuthor>> {
    return sdDb('Failed to create ServiceDesk change window', () =>
      prisma.sdChangeWindow.create({
        data: { ...data, workspaceId, createdById },
        include,
      }),
    )
  },

  async update(
    id: string,
    workspaceId: string,
    data: SdChangeWindowData,
  ): Promise<Result<SdChangeWindowWithAuthor>> {
    return sdDb('Failed to update ServiceDesk change window', () =>
      prisma.sdChangeWindow.update({
        where: { id, workspaceId },
        data,
        include,
      }),
    )
  },

  async softDelete(id: string, workspaceId: string): Promise<Result<void>> {
    return sdDb('Failed to delete ServiceDesk change window', async () => {
      await prisma.sdChangeWindow.update({
        where: { id, workspaceId },
        data: { deletedAt: new Date() },
      })
    })
  },
}
