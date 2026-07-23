import { auditMutation } from '@/lib/axiom/audit'
import { ok, type Result } from '@/src/lib/result'
import {
  toCrmOpportunityDTO,
  toCrmOpportunityLineItemDTO,
} from '@/src/mappers/crm-opportunity.mapper'
import {
  CrmOpportunityLineItemRepository,
  CrmOpportunityRepository,
} from '@/src/repositories/crm-opportunity.repository'
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

    const result = await CrmOpportunityRepository.create({
      workspaceId,
      createdById: actorId,
      name: dto.name,
      amount: dto.amount,
      closeDate: dto.closeDate,
      pipelineId: dto.pipelineId,
      stageId: dto.stageId,
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

    const result = await CrmOpportunityRepository.update(opportunityId, {
      name: dto.name,
      amount: dto.amount,
      closeDate: dto.closeDate,
      stageId: dto.stageId,
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
