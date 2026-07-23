import { auditMutation } from '@/lib/axiom/audit'
import { badRequest, crmPipelineNotFound } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  toCrmOpportunityDTO,
  toCrmOpportunityLineItemDTO,
} from '@/src/mappers/crm-opportunity.mapper'
import {
  CrmOpportunityLineItemRepository,
  CrmOpportunityRepository,
} from '@/src/repositories/crm-opportunity.repository'
import {
  CrmPipelineRepository,
  CrmPipelineStageRepository,
} from '@/src/repositories/crm-pipeline.repository'
import type {
  CreateCrmOpportunityDTO,
  CreateCrmOpportunityLineItemDTO,
  UpdateCrmOpportunityDTO,
  UpdateCrmOpportunityLineItemDTO,
} from '@/src/schemas/crm-opportunity.schema'
import type {
  CrmOpportunityDTO,
  CrmOpportunityLineItemDTO,
} from '@/types/crm-opportunity'
import { assertMember } from './authz'
import { CrmPipelineService } from './crm-pipeline.service'

type StageRefs = { pipelineId: string; stageId: string }

/** Primeira etapa (categoria OPEN, ou a primeira por posição) do pipeline. */
async function firstStageOf(
  workspaceId: string,
  pipelineId: string,
): Promise<Result<string>> {
  const pipeline = await CrmPipelineRepository.findById(pipelineId, workspaceId)
  if (!pipeline.ok) return pipeline

  const stages = await CrmPipelineStageRepository.listByPipeline(pipelineId)
  if (!stages.ok) return stages
  if (stages.value.length === 0) return err(crmPipelineNotFound())

  const ordered = [...stages.value].sort((a, b) => a.position - b.position)
  const stage = ordered.find((s) => s.category === 'OPEN') ?? ordered[0]
  return ok(stage.id)
}

/** Valida que `stageId` pertence ao `pipelineId` informado e à workspace. */
async function assertStage(
  workspaceId: string,
  pipelineId: string,
  stageId: string,
): Promise<Result<true>> {
  const pipeline = await CrmPipelineRepository.findById(pipelineId, workspaceId)
  if (!pipeline.ok) return pipeline

  const stage = await CrmPipelineStageRepository.findById(stageId, pipelineId)
  if (!stage.ok) return stage

  return ok(true)
}

/** Resolve pipeline+etapa para a criação, aplicando os defaults da workspace. */
async function resolveStageForCreate(
  workspaceId: string,
  input: { pipelineId?: string; stageId?: string },
): Promise<Result<StageRefs>> {
  if (input.stageId) {
    if (!input.pipelineId) {
      return err(badRequest('Informe o pipeline ao definir a etapa'))
    }
    const valid = await assertStage(
      workspaceId,
      input.pipelineId,
      input.stageId,
    )
    if (!valid.ok) return valid
    return ok({ pipelineId: input.pipelineId, stageId: input.stageId })
  }
  if (input.pipelineId) {
    const stage = await firstStageOf(workspaceId, input.pipelineId)
    if (!stage.ok) return stage
    return ok({ pipelineId: input.pipelineId, stageId: stage.value })
  }
  return CrmPipelineService.resolveDefaultStage(workspaceId)
}

/**
 * Resolve pipeline+etapa para a atualização. Retorna `null` quando nem
 * pipelineId nem stageId foram informados (nada a mudar). Quando só
 * pipelineId muda, a etapa é resolvida para a primeira do pipeline alvo.
 */
async function resolveStageForUpdate(
  workspaceId: string,
  currentPipelineId: string,
  input: { pipelineId?: string; stageId?: string },
): Promise<Result<StageRefs | null>> {
  if (input.pipelineId === undefined && input.stageId === undefined) {
    return ok(null)
  }
  const targetPipelineId = input.pipelineId ?? currentPipelineId
  if (input.stageId !== undefined) {
    const valid = await assertStage(
      workspaceId,
      targetPipelineId,
      input.stageId,
    )
    if (!valid.ok) return valid
    return ok({ pipelineId: targetPipelineId, stageId: input.stageId })
  }
  const stage = await firstStageOf(workspaceId, targetPipelineId)
  if (!stage.ok) return stage
  return ok({ pipelineId: targetPipelineId, stageId: stage.value })
}

export const CrmOpportunityService = {
  async list(
    actorId: string,
    workspaceId: string,
    filters: { pipelineId?: string; stageId?: string },
  ): Promise<Result<CrmOpportunityDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmOpportunityRepository.listByWorkspace(
      workspaceId,
      filters,
    )
    if (!result.ok) return result

    return ok(result.value.map(toCrmOpportunityDTO))
  },

  async getById(
    actorId: string,
    workspaceId: string,
    opportunityId: string,
  ): Promise<Result<CrmOpportunityDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmOpportunityRepository.findById(
      opportunityId,
      workspaceId,
    )
    if (!result.ok) return result

    return ok(toCrmOpportunityDTO(result.value))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmOpportunityDTO,
  ): Promise<Result<CrmOpportunityDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const stageRefs = await resolveStageForCreate(workspaceId, {
      pipelineId: dto.pipelineId,
      stageId: dto.stageId,
    })
    if (!stageRefs.ok) return stageRefs

    const result = await CrmOpportunityRepository.create({
      workspaceId,
      createdById: actorId,
      name: dto.name,
      amount: dto.amount,
      closeDate: dto.closeDate,
      pipelineId: stageRefs.value.pipelineId,
      stageId: stageRefs.value.stageId,
      companyId: dto.companyId,
      pointOfContactId: dto.pointOfContactId,
      ownerId: dto.ownerId,
      source: dto.source,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_opportunity',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_opportunity',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toCrmOpportunityDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    opportunityId: string,
    dto: UpdateCrmOpportunityDTO,
  ): Promise<Result<CrmOpportunityDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmOpportunityRepository.findById(
      opportunityId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const stageRefs = await resolveStageForUpdate(
      workspaceId,
      existing.value.pipelineId,
      { pipelineId: dto.pipelineId, stageId: dto.stageId },
    )
    if (!stageRefs.ok) return stageRefs

    const result = await CrmOpportunityRepository.update(opportunityId, {
      name: dto.name,
      amount: dto.amount,
      closeDate: dto.closeDate,
      pipelineId: stageRefs.value?.pipelineId,
      stageId: stageRefs.value?.stageId,
      companyId: dto.companyId,
      pointOfContactId: dto.pointOfContactId,
      ownerId: dto.ownerId,
      source: dto.source,
      updatedById: actorId,
    })
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_opportunity',
      action: 'update',
      actorId,
      targetId: opportunityId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toCrmOpportunityDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    opportunityId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmOpportunityRepository.findById(
      opportunityId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmOpportunityRepository.softDelete(opportunityId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_opportunity',
      action: 'delete',
      actorId,
      targetId: opportunityId,
    })

    return ok(undefined)
  },

  async reorderInStage(
    actorId: string,
    workspaceId: string,
    stageId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    return CrmOpportunityRepository.reorderInStage(stageId, orderedIds)
  },

  async reorder(
    actorId: string,
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    return CrmOpportunityRepository.reorder(workspaceId, orderedIds)
  },
}

export const CrmOpportunityLineItemService = {
  async list(
    actorId: string,
    workspaceId: string,
    opportunityId: string,
  ): Promise<Result<CrmOpportunityLineItemDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const opportunity = await CrmOpportunityRepository.findById(
      opportunityId,
      workspaceId,
    )
    if (!opportunity.ok) return opportunity

    const result =
      await CrmOpportunityLineItemRepository.listByOpportunity(opportunityId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmOpportunityLineItemDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    opportunityId: string,
    dto: CreateCrmOpportunityLineItemDTO,
  ): Promise<Result<CrmOpportunityLineItemDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const opportunity = await CrmOpportunityRepository.findById(
      opportunityId,
      workspaceId,
    )
    if (!opportunity.ok) return opportunity

    const result = await CrmOpportunityLineItemRepository.create({
      opportunityId,
      productId: dto.productId,
      name: dto.name,
      quantity: dto.quantity,
      unitPrice: dto.unitPrice,
      discountPct: dto.discountPct,
      billingType: dto.billingType,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_opportunity_line_item',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_opportunity_line_item',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toCrmOpportunityLineItemDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    opportunityId: string,
    lineItemId: string,
    dto: UpdateCrmOpportunityLineItemDTO,
  ): Promise<Result<CrmOpportunityLineItemDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const opportunity = await CrmOpportunityRepository.findById(
      opportunityId,
      workspaceId,
    )
    if (!opportunity.ok) return opportunity

    const existing = await CrmOpportunityLineItemRepository.findById(
      lineItemId,
      opportunityId,
    )
    if (!existing.ok) return existing

    const result = await CrmOpportunityLineItemRepository.update(
      lineItemId,
      dto,
    )
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_opportunity_line_item',
      action: 'update',
      actorId,
      targetId: lineItemId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toCrmOpportunityLineItemDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    opportunityId: string,
    lineItemId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const opportunity = await CrmOpportunityRepository.findById(
      opportunityId,
      workspaceId,
    )
    if (!opportunity.ok) return opportunity

    const existing = await CrmOpportunityLineItemRepository.findById(
      lineItemId,
      opportunityId,
    )
    if (!existing.ok) return existing

    const result = await CrmOpportunityLineItemRepository.delete(lineItemId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_opportunity_line_item',
      action: 'delete',
      actorId,
      targetId: lineItemId,
    })

    return ok(undefined)
  },
}
