import { auditMutation } from '@/lib/axiom/audit'
import { crmPipelineNotFound } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  toCrmPipelineDTO,
  toCrmPipelineStageDTO,
} from '@/src/mappers/crm-pipeline.mapper'
import {
  CrmPipelineRepository,
  CrmPipelineStageRepository,
} from '@/src/repositories/crm-pipeline.repository'
import type {
  CreateCrmPipelineDTO,
  CreateCrmPipelineStageDTO,
  UpdateCrmPipelineDTO,
  UpdateCrmPipelineStageDTO,
} from '@/src/schemas/crm-pipeline.schema'
import type { CrmPipelineDTO, CrmPipelineStageDTO } from '@/types/crm-pipeline'
import { assertMember } from './authz'

export const CrmPipelineService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<CrmPipelineDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmPipelineRepository.listByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmPipelineDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmPipelineDTO,
  ): Promise<Result<CrmPipelineDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmPipelineRepository.create({
      workspaceId,
      createdById: actorId,
      name: dto.name,
      isDefault: dto.isDefault,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_pipeline',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_pipeline',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toCrmPipelineDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    pipelineId: string,
    dto: UpdateCrmPipelineDTO,
  ): Promise<Result<CrmPipelineDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmPipelineRepository.findById(
      pipelineId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmPipelineRepository.update(pipelineId, {
      name: dto.name,
      isDefault: dto.isDefault,
      updatedById: actorId,
    })
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_pipeline',
      action: 'update',
      actorId,
      targetId: pipelineId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toCrmPipelineDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    pipelineId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmPipelineRepository.findById(
      pipelineId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmPipelineRepository.softDelete(pipelineId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_pipeline',
      action: 'delete',
      actorId,
      targetId: pipelineId,
    })

    return ok(undefined)
  },

  async reorder(
    actorId: string,
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    return CrmPipelineRepository.reorder(workspaceId, orderedIds)
  },

  /// Resolve o pipeline padrão da workspace (ou o primeiro, se nenhum estiver
  /// marcado como padrão) e sua primeira etapa (categoria OPEN, ou a primeira
  /// por posição). Usado por CrmOpportunityService quando pipeline/etapa são
  /// omitidos na criação de uma oportunidade.
  async resolveDefaultStage(
    workspaceId: string,
  ): Promise<Result<{ pipelineId: string; stageId: string }>> {
    const def = await CrmPipelineRepository.findDefault(workspaceId)
    if (!def.ok) return def

    let pipeline = def.value
    if (!pipeline) {
      const all = await CrmPipelineRepository.listByWorkspace(workspaceId)
      if (!all.ok) return all
      pipeline = all.value[0] ?? null
    }
    if (!pipeline) return err(crmPipelineNotFound())

    const stages = await CrmPipelineStageRepository.listByPipeline(pipeline.id)
    if (!stages.ok) return stages
    if (stages.value.length === 0) return err(crmPipelineNotFound())

    const ordered = [...stages.value].sort((a, b) => a.position - b.position)
    const stage = ordered.find((s) => s.category === 'OPEN') ?? ordered[0]
    return ok({ pipelineId: pipeline.id, stageId: stage.id })
  },
}

export const CrmPipelineStageService = {
  async list(
    actorId: string,
    workspaceId: string,
    pipelineId: string,
  ): Promise<Result<CrmPipelineStageDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const pipeline = await CrmPipelineRepository.findById(
      pipelineId,
      workspaceId,
    )
    if (!pipeline.ok) return pipeline

    const result = await CrmPipelineStageRepository.listByPipeline(pipelineId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmPipelineStageDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    pipelineId: string,
    dto: CreateCrmPipelineStageDTO,
  ): Promise<Result<CrmPipelineStageDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const pipeline = await CrmPipelineRepository.findById(
      pipelineId,
      workspaceId,
    )
    if (!pipeline.ok) return pipeline

    const result = await CrmPipelineStageRepository.create({
      pipelineId,
      name: dto.name,
      probability: dto.probability,
      category: dto.category,
      color: dto.color,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_pipeline_stage',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_pipeline_stage',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toCrmPipelineStageDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    pipelineId: string,
    stageId: string,
    dto: UpdateCrmPipelineStageDTO,
  ): Promise<Result<CrmPipelineStageDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const pipeline = await CrmPipelineRepository.findById(
      pipelineId,
      workspaceId,
    )
    if (!pipeline.ok) return pipeline

    const existing = await CrmPipelineStageRepository.findById(
      stageId,
      pipelineId,
    )
    if (!existing.ok) return existing

    const result = await CrmPipelineStageRepository.update(stageId, dto)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_pipeline_stage',
      action: 'update',
      actorId,
      targetId: stageId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toCrmPipelineStageDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    pipelineId: string,
    stageId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const pipeline = await CrmPipelineRepository.findById(
      pipelineId,
      workspaceId,
    )
    if (!pipeline.ok) return pipeline

    const existing = await CrmPipelineStageRepository.findById(
      stageId,
      pipelineId,
    )
    if (!existing.ok) return existing

    const result = await CrmPipelineStageRepository.delete(stageId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_pipeline_stage',
      action: 'delete',
      actorId,
      targetId: stageId,
    })

    return ok(undefined)
  },

  async reorder(
    actorId: string,
    workspaceId: string,
    pipelineId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const pipeline = await CrmPipelineRepository.findById(
      pipelineId,
      workspaceId,
    )
    if (!pipeline.ok) return pipeline

    return CrmPipelineStageRepository.reorder(pipelineId, orderedIds)
  },
}
