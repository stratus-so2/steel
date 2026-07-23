import type { CrmPipeline, CrmPipelineStage } from '@prisma/client'
import type { CrmPipelineDTO, CrmPipelineStageDTO } from '@/types/crm-pipeline'

export function toCrmPipelineDTO(pipeline: CrmPipeline): CrmPipelineDTO {
  return {
    id: pipeline.id,
    workspaceId: pipeline.workspaceId,
    name: pipeline.name,
    position: pipeline.position,
    isDefault: pipeline.isDefault,
    createdById: pipeline.createdById,
    updatedById: pipeline.updatedById,
    createdAt: pipeline.createdAt.toISOString(),
    updatedAt: pipeline.updatedAt.toISOString(),
  }
}

export function toCrmPipelineStageDTO(
  stage: CrmPipelineStage,
): CrmPipelineStageDTO {
  return {
    id: stage.id,
    pipelineId: stage.pipelineId,
    name: stage.name,
    position: stage.position,
    probability: stage.probability,
    category: stage.category,
    color: stage.color,
    createdAt: stage.createdAt.toISOString(),
    updatedAt: stage.updatedAt.toISOString(),
  }
}
