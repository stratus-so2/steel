import type { WorkspaceFeatureOverride } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export interface UpsertWorkspaceFeatureOverrideInput {
  workspaceId: string
  key: string
  enabled: boolean
  note: string | null
  expiresAt: Date | null
  updatedById: string
}

export const WorkspaceFeatureOverrideRepository = {
  async listByWorkspace(
    workspaceId: string,
  ): Promise<Result<WorkspaceFeatureOverride[]>> {
    try {
      const overrides = await prisma.workspaceFeatureOverride.findMany({
        where: { workspaceId },
      })
      return ok(overrides)
    } catch (error) {
      return err(dbError('Failed to list workspace feature overrides', error))
    }
  },

  async upsert(
    input: UpsertWorkspaceFeatureOverrideInput,
  ): Promise<Result<WorkspaceFeatureOverride>> {
    const { workspaceId, key, ...data } = input
    try {
      const override = await prisma.workspaceFeatureOverride.upsert({
        where: { workspaceId_key: { workspaceId, key } },
        create: { workspaceId, key, ...data },
        update: data,
      })
      return ok(override)
    } catch (error) {
      return err(dbError('Failed to upsert workspace feature override', error))
    }
  },

  /** Remove o override (volta ao default do plano). `true` se havia um. */
  async remove(workspaceId: string, key: string): Promise<Result<boolean>> {
    try {
      const { count } = await prisma.workspaceFeatureOverride.deleteMany({
        where: { workspaceId, key },
      })
      return ok(count > 0)
    } catch (error) {
      return err(dbError('Failed to remove workspace feature override', error))
    }
  },
}
