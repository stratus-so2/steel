import type {
  CrmPipeline,
  CrmPipelineStage,
  CrmStageCategory,
} from '@prisma/client'
import { notFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const CrmPipelineRepository = {
  async listByWorkspace(workspaceId: string): Promise<Result<CrmPipeline[]>> {
    try {
      const pipelines = await prisma.crmPipeline.findMany({
        where: { workspaceId, deletedAt: null },
        orderBy: { position: 'asc' },
      })
      return ok(pipelines)
    } catch (error) {
      return err(dbError('Failed to list CRM pipelines', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<CrmPipeline>> {
    try {
      const pipeline = await prisma.crmPipeline.findFirst({
        where: { id, workspaceId, deletedAt: null },
      })
      if (!pipeline) return err(notFound('CrmPipeline'))
      return ok(pipeline)
    } catch (error) {
      return err(dbError('Failed to find CRM pipeline by id', error))
    }
  },

  async create(data: {
    workspaceId: string
    createdById: string
    name: string
    isDefault?: boolean
  }): Promise<Result<CrmPipeline>> {
    try {
      const position = await prisma.crmPipeline.count({
        where: { workspaceId: data.workspaceId, deletedAt: null },
      })
      const pipeline = await prisma.crmPipeline.create({
        data: { ...data, position },
      })
      return ok(pipeline)
    } catch (error) {
      return err(dbError('Failed to create CRM pipeline', error))
    }
  },

  async update(
    id: string,
    data: { name?: string; isDefault?: boolean; updatedById?: string },
  ): Promise<Result<CrmPipeline>> {
    try {
      const pipeline = await prisma.crmPipeline.update({
        where: { id },
        data,
      })
      return ok(pipeline)
    } catch (error) {
      return err(dbError('Failed to update CRM pipeline', error))
    }
  },

  async softDelete(id: string): Promise<Result<void>> {
    try {
      await prisma.crmPipeline.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete CRM pipeline', error))
    }
  },

  async reorder(
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    try {
      await prisma.$transaction(
        orderedIds.map((id, position) =>
          prisma.crmPipeline.update({
            where: { id, workspaceId },
            data: { position },
          }),
        ),
      )
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to reorder CRM pipelines', error))
    }
  },
}

export const CrmPipelineStageRepository = {
  async listByPipeline(
    pipelineId: string,
  ): Promise<Result<CrmPipelineStage[]>> {
    try {
      const stages = await prisma.crmPipelineStage.findMany({
        where: { pipelineId },
        orderBy: { position: 'asc' },
      })
      return ok(stages)
    } catch (error) {
      return err(dbError('Failed to list CRM pipeline stages', error))
    }
  },

  async findById(
    id: string,
    pipelineId: string,
  ): Promise<Result<CrmPipelineStage>> {
    try {
      const stage = await prisma.crmPipelineStage.findFirst({
        where: { id, pipelineId },
      })
      if (!stage) return err(notFound('CrmPipelineStage'))
      return ok(stage)
    } catch (error) {
      return err(dbError('Failed to find CRM pipeline stage by id', error))
    }
  },

  async create(data: {
    pipelineId: string
    name: string
    probability?: number
    category?: CrmStageCategory
    color?: string
  }): Promise<Result<CrmPipelineStage>> {
    try {
      const position = await prisma.crmPipelineStage.count({
        where: { pipelineId: data.pipelineId },
      })
      const stage = await prisma.crmPipelineStage.create({
        data: { ...data, position },
      })
      return ok(stage)
    } catch (error) {
      return err(dbError('Failed to create CRM pipeline stage', error))
    }
  },

  async update(
    id: string,
    data: {
      name?: string
      probability?: number
      category?: CrmStageCategory
      color?: string
    },
  ): Promise<Result<CrmPipelineStage>> {
    try {
      const stage = await prisma.crmPipelineStage.update({
        where: { id },
        data,
      })
      return ok(stage)
    } catch (error) {
      return err(dbError('Failed to update CRM pipeline stage', error))
    }
  },

  async delete(id: string): Promise<Result<void>> {
    try {
      await prisma.crmPipelineStage.delete({ where: { id } })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete CRM pipeline stage', error))
    }
  },

  async reorder(
    pipelineId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    try {
      await prisma.$transaction(
        orderedIds.map((id, position) =>
          prisma.crmPipelineStage.update({
            where: { id, pipelineId },
            data: { position },
          }),
        ),
      )
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to reorder CRM pipeline stages', error))
    }
  },
}
