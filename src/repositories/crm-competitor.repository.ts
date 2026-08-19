import type {
  CrmCompetitorMetricSnapshot,
  CrmCompetitorSyncStatus,
  CrmSocialPlatform,
  CrmTrackedCompetitor,
} from '@prisma/client'
import { notFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export type CreateCrmCompetitorData = {
  workspaceId: string
  createdById: string
  platform: CrmSocialPlatform
  handle: string
  profileUrl?: string | null
  followersCount?: number | null
  avatarUrl?: string | null
  displayName?: string | null
  bio?: string | null
  notes?: string | null
}

export type UpdateCrmCompetitorData = {
  updatedById: string
  platform?: CrmSocialPlatform
  handle?: string
  profileUrl?: string | null
  followersCount?: number | null
  avatarUrl?: string | null
  displayName?: string | null
  bio?: string | null
  notes?: string | null
}

export type SyncCrmCompetitorResultData = {
  syncStatus: CrmCompetitorSyncStatus
  lastSyncedAt: Date
  followersCount?: number
  avatarUrl?: string | null
  displayName?: string | null
  bio?: string | null
}

export const CrmCompetitorRepository = {
  async listByWorkspace(
    workspaceId: string,
  ): Promise<Result<CrmTrackedCompetitor[]>> {
    try {
      const items = await prisma.crmTrackedCompetitor.findMany({
        where: { workspaceId, deletedAt: null },
        orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      })
      return ok(items)
    } catch (error) {
      return err(dbError('Failed to list CRM tracked competitors', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<CrmTrackedCompetitor>> {
    try {
      const item = await prisma.crmTrackedCompetitor.findFirst({
        where: { id, workspaceId, deletedAt: null },
      })
      if (!item) return err(notFound('CrmTrackedCompetitor'))
      return ok(item)
    } catch (error) {
      return err(dbError('Failed to find CRM tracked competitor by id', error))
    }
  },

  async create(
    data: CreateCrmCompetitorData,
  ): Promise<Result<CrmTrackedCompetitor>> {
    try {
      const item = await prisma.crmTrackedCompetitor.create({ data })
      return ok(item)
    } catch (error) {
      return err(dbError('Failed to create CRM tracked competitor', error))
    }
  },

  async update(
    id: string,
    data: UpdateCrmCompetitorData,
  ): Promise<Result<CrmTrackedCompetitor>> {
    try {
      const item = await prisma.crmTrackedCompetitor.update({
        where: { id },
        data,
      })
      return ok(item)
    } catch (error) {
      return err(dbError('Failed to update CRM tracked competitor', error))
    }
  },

  async softDelete(id: string, updatedById: string): Promise<Result<void>> {
    try {
      await prisma.crmTrackedCompetitor.update({
        where: { id },
        data: { deletedAt: new Date(), updatedById },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete CRM tracked competitor', error))
    }
  },

  async reorder(
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    try {
      await prisma.$transaction(
        orderedIds.map((id, index) =>
          prisma.crmTrackedCompetitor.updateMany({
            where: { id, workspaceId, deletedAt: null },
            data: { position: index + 1 },
          }),
        ),
      )
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to reorder CRM tracked competitors', error))
    }
  },

  /**
   * Todos os concorrentes ativos em plataformas com sync automático
   * (Instagram/YouTube), de todos os workspaces — usado pelo job diário
   * `CrmCompetitorSync`, que roda fora do contexto de um único workspace.
   */
  async listSyncable(): Promise<Result<CrmTrackedCompetitor[]>> {
    try {
      const items = await prisma.crmTrackedCompetitor.findMany({
        where: {
          deletedAt: null,
          platform: { in: ['INSTAGRAM', 'YOUTUBE'] },
        },
      })
      return ok(items)
    } catch (error) {
      return err(
        dbError('Failed to list syncable CRM tracked competitors', error),
      )
    }
  },

  /** Grava o resultado (sucesso ou falha) de uma tentativa de sync. */
  async recordSyncResult(
    id: string,
    data: SyncCrmCompetitorResultData,
  ): Promise<Result<CrmTrackedCompetitor>> {
    try {
      const item = await prisma.crmTrackedCompetitor.update({
        where: { id },
        data,
      })
      return ok(item)
    } catch (error) {
      return err(
        dbError('Failed to record CRM tracked competitor sync result', error),
      )
    }
  },

  /** Novo ponto na série histórica de seguidores/posts do concorrente. */
  async createSnapshot(
    competitorId: string,
    data: { followersCount: number; postsCount?: number | null },
  ): Promise<Result<CrmCompetitorMetricSnapshot>> {
    try {
      const snapshot = await prisma.crmCompetitorMetricSnapshot.create({
        data: { competitorId, ...data },
      })
      return ok(snapshot)
    } catch (error) {
      return err(
        dbError('Failed to create CRM competitor metric snapshot', error),
      )
    }
  },

  /** Série histórica do concorrente a partir de `since`, mais antigo primeiro. */
  async listSnapshotsSince(
    competitorId: string,
    since: Date,
  ): Promise<Result<CrmCompetitorMetricSnapshot[]>> {
    try {
      const snapshots = await prisma.crmCompetitorMetricSnapshot.findMany({
        where: { competitorId, capturedAt: { gte: since } },
        orderBy: { capturedAt: 'asc' },
      })
      return ok(snapshots)
    } catch (error) {
      return err(
        dbError('Failed to list CRM competitor metric snapshots', error),
      )
    }
  },
}
