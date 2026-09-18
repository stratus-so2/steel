import type {
  AiUsageFeature,
  Prisma,
  UserAiPreference,
  WorkspaceAiSettings,
} from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const WorkspaceAiSettingsRepository = {
  async findByWorkspace(
    workspaceId: string,
  ): Promise<Result<WorkspaceAiSettings | null>> {
    try {
      const settings = await prisma.workspaceAiSettings.findUnique({
        where: { workspaceId },
      })
      return ok(settings)
    } catch (error) {
      return err(dbError('Failed to find workspace AI settings', error))
    }
  },

  async upsert(
    workspaceId: string,
    data: Omit<Prisma.WorkspaceAiSettingsUncheckedCreateInput, 'workspaceId'>,
  ): Promise<Result<WorkspaceAiSettings>> {
    try {
      const settings = await prisma.workspaceAiSettings.upsert({
        where: { workspaceId },
        create: { workspaceId, ...data },
        update: data,
      })
      return ok(settings)
    } catch (error) {
      return err(dbError('Failed to upsert workspace AI settings', error))
    }
  },
}

export const UserAiPreferenceRepository = {
  async find(
    workspaceId: string,
    userId: string,
  ): Promise<Result<UserAiPreference | null>> {
    try {
      const preference = await prisma.userAiPreference.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
      })
      return ok(preference)
    } catch (error) {
      return err(dbError('Failed to find user AI preference', error))
    }
  },

  async upsert(
    workspaceId: string,
    userId: string,
    modelKey: string,
  ): Promise<Result<UserAiPreference>> {
    try {
      const preference = await prisma.userAiPreference.upsert({
        where: { workspaceId_userId: { workspaceId, userId } },
        create: { workspaceId, userId, modelKey },
        update: { modelKey },
      })
      return ok(preference)
    } catch (error) {
      return err(dbError('Failed to upsert user AI preference', error))
    }
  },

  async remove(workspaceId: string, userId: string): Promise<Result<void>> {
    try {
      await prisma.userAiPreference.deleteMany({
        where: { workspaceId, userId },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to remove user AI preference', error))
    }
  },
}

export interface AiUsageTotals {
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export const AiUsageRepository = {
  async record(data: {
    workspaceId: string
    userId: string | null
    feature: AiUsageFeature
    provider: string
    model: string
    inputTokens: number
    outputTokens: number
    costUsd: number
  }): Promise<Result<void>> {
    try {
      await prisma.aiUsage.create({ data })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to record AI usage', error))
    }
  },

  async sumSince(
    workspaceId: string,
    since: Date,
  ): Promise<Result<AiUsageTotals>> {
    try {
      const totals = await prisma.aiUsage.aggregate({
        where: { workspaceId, createdAt: { gte: since } },
        _sum: { inputTokens: true, outputTokens: true, costUsd: true },
      })
      return ok({
        inputTokens: totals._sum.inputTokens ?? 0,
        outputTokens: totals._sum.outputTokens ?? 0,
        costUsd: totals._sum.costUsd?.toNumber() ?? 0,
      })
    } catch (error) {
      return err(dbError('Failed to sum AI usage', error))
    }
  },
}
