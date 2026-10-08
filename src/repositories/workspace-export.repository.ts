import {
  Prisma,
  type WorkspaceExportKind,
  type WorkspaceExportStatus,
} from '@prisma/client'
import { workspaceExportNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const WORKSPACE_EXPORT_INCLUDE = {
  requestedBy: { select: { id: true, name: true, email: true } },
} as const satisfies Prisma.WorkspaceExportInclude

export type WorkspaceExportWithRelations = Prisma.WorkspaceExportGetPayload<{
  include: typeof WORKSPACE_EXPORT_INCLUDE
}>

export interface CreateWorkspaceExportData {
  workspaceId: string
  kind: WorkspaceExportKind
  requestedById: string
  dayKey: string
  periodFrom?: Date | null
  periodTo?: Date | null
}

/** Unique (workspace, kind, day) already taken: the daily slot is used. */
export const DAILY_SLOT_TAKEN = 'DAILY_SLOT_TAKEN' as const

/** Workspace exports (Ajustes › Exportações). No business rules. */
export const WorkspaceExportRepository = {
  /**
   * Creates the request. The unique `(workspace_id, kind, day_key)` makes
   * the once-a-day rule hold under concurrent clicks: the loser gets
   * `ok(DAILY_SLOT_TAKEN)`.
   */
  async create(
    data: CreateWorkspaceExportData,
  ): Promise<Result<WorkspaceExportWithRelations | typeof DAILY_SLOT_TAKEN>> {
    try {
      const row = await prisma.workspaceExport.create({
        data,
        include: WORKSPACE_EXPORT_INCLUDE,
      })
      return ok(row)
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return ok(DAILY_SLOT_TAKEN)
      }
      return err(dbError('Failed to create workspace export', error))
    }
  },

  async findById(
    id: string,
    workspaceId?: string,
  ): Promise<Result<WorkspaceExportWithRelations>> {
    try {
      const row = await prisma.workspaceExport.findFirst({
        where: { id, ...(workspaceId ? { workspaceId } : {}) },
        include: WORKSPACE_EXPORT_INCLUDE,
      })
      if (!row) return err(workspaceExportNotFound())
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find workspace export', error))
    }
  },

  async listByWorkspace(
    workspaceId: string,
    limit = 50,
  ): Promise<Result<WorkspaceExportWithRelations[]>> {
    try {
      const rows = await prisma.workspaceExport.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: WORKSPACE_EXPORT_INCLUDE,
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list workspace exports', error))
    }
  },

  /** Kinds whose daily slot `dayKey` is already taken. */
  async takenKinds(
    workspaceId: string,
    dayKey: string,
  ): Promise<Result<WorkspaceExportKind[]>> {
    try {
      const rows = await prisma.workspaceExport.findMany({
        where: { workspaceId, dayKey },
        select: { kind: true },
      })
      return ok(rows.map((row) => row.kind))
    } catch (error) {
      return err(dbError('Failed to read workspace export slots', error))
    }
  },

  async markRunning(id: string): Promise<Result<void>> {
    return update(id, { status: 'RUNNING', startedAt: new Date() })
  },

  async markCompleted(
    id: string,
    data: {
      storageKey: string
      fileName: string
      sizeBytes: number
      itemCount: number
      completedAt: Date
      expiresAt: Date
    },
  ): Promise<Result<void>> {
    return update(id, {
      status: 'COMPLETED',
      storageKey: data.storageKey,
      fileName: data.fileName,
      sizeBytes: BigInt(data.sizeBytes),
      itemCount: data.itemCount,
      completedAt: data.completedAt,
      expiresAt: data.expiresAt,
      errorMessage: null,
    })
  },

  /** Failed: frees the daily slot (`day_key` → null) so it can be retried. */
  async markFailed(id: string, message: string): Promise<Result<void>> {
    return update(id, {
      status: 'FAILED',
      dayKey: null,
      errorMessage: message.slice(0, 500),
      completedAt: new Date(),
    })
  },

  async listExpired(
    now: Date,
  ): Promise<Result<{ id: string; storageKey: string | null }[]>> {
    try {
      const rows = await prisma.workspaceExport.findMany({
        where: { status: 'COMPLETED', expiresAt: { lte: now } },
        select: { id: true, storageKey: true },
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list expired workspace exports', error))
    }
  },

  async markExpired(ids: string[]): Promise<Result<number>> {
    if (ids.length === 0) return ok(0)
    try {
      const result = await prisma.workspaceExport.updateMany({
        where: { id: { in: ids } },
        data: { status: 'EXPIRED', storageKey: null },
      })
      return ok(result.count)
    } catch (error) {
      return err(dbError('Failed to expire workspace exports', error))
    }
  },

  /** Storage keys still referenced by a downloadable export. */
  async liveStorageKeys(): Promise<Result<Set<string>>> {
    try {
      const rows = await prisma.workspaceExport.findMany({
        where: { storageKey: { not: null } },
        select: { storageKey: true },
      })
      return ok(new Set(rows.map((row) => row.storageKey as string)))
    } catch (error) {
      return err(dbError('Failed to list workspace export files', error))
    }
  },
}

async function update(
  id: string,
  data: Prisma.WorkspaceExportUpdateInput & { status?: WorkspaceExportStatus },
): Promise<Result<void>> {
  try {
    await prisma.workspaceExport.update({ where: { id }, data })
    return ok(undefined)
  } catch (error) {
    return err(dbError('Failed to update workspace export', error))
  }
}
