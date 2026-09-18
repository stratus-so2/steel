import type { Backup, BackupScope } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const BackupRepository = {
  async list(params: {
    scope?: BackupScope
    workspaceId?: string
    limit: number
  }): Promise<Result<Backup[]>> {
    try {
      const backups = await prisma.backup.findMany({
        where: {
          ...(params.scope && { scope: params.scope }),
          ...(params.workspaceId && { workspaceId: params.workspaceId }),
        },
        orderBy: { startedAt: 'desc' },
        take: params.limit,
      })
      return ok(backups)
    } catch (error) {
      return err(dbError('Failed to list backups', error))
    }
  },

  async findById(id: string): Promise<Result<Backup | null>> {
    try {
      const backup = await prisma.backup.findUnique({ where: { id } })
      return ok(backup)
    } catch (error) {
      return err(dbError('Failed to find backup', error))
    }
  },

  /** Dos ids informados, quais workspaces ainda existem. */
  async existingWorkspaceIds(ids: string[]): Promise<Result<Set<string>>> {
    if (ids.length === 0) return ok(new Set())
    try {
      const rows = await prisma.workspace.findMany({
        where: { id: { in: ids } },
        select: { id: true },
      })
      return ok(new Set(rows.map((row) => row.id)))
    } catch (error) {
      return err(dbError('Failed to check backup workspaces', error))
    }
  },
}
