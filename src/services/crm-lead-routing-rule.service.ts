import { auditMutation } from '@/lib/axiom/audit'
import { ok, type Result } from '@/src/lib/result'
import { toCrmLeadRoutingRuleDTO } from '@/src/mappers/crm-lead.mapper'
import { CrmLeadRoutingRuleRepository } from '@/src/repositories/crm-lead-routing-rule.repository'
import type {
  CreateCrmLeadRoutingRuleDTO,
  UpdateCrmLeadRoutingRuleDTO,
} from '@/src/schemas/crm-lead.schema'
import type { CrmLeadRoutingRuleDTO } from '@/types/crm-lead'
import { assertMember } from './authz'

export const CrmLeadRoutingRuleService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<CrmLeadRoutingRuleDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result =
      await CrmLeadRoutingRuleRepository.listByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmLeadRoutingRuleDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmLeadRoutingRuleDTO,
  ): Promise<Result<CrmLeadRoutingRuleDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmLeadRoutingRuleRepository.create({
      workspaceId,
      field: dto.field,
      operator: dto.operator,
      value: dto.value,
      ownerId: dto.ownerId,
      active: dto.active,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_lead_routing_rule',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_lead_routing_rule',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toCrmLeadRoutingRuleDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    ruleId: string,
    dto: UpdateCrmLeadRoutingRuleDTO,
  ): Promise<Result<CrmLeadRoutingRuleDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmLeadRoutingRuleRepository.findById(
      ruleId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmLeadRoutingRuleRepository.update(ruleId, dto)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_lead_routing_rule',
      action: 'update',
      actorId,
      targetId: ruleId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toCrmLeadRoutingRuleDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    ruleId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmLeadRoutingRuleRepository.findById(
      ruleId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmLeadRoutingRuleRepository.delete(ruleId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_lead_routing_rule',
      action: 'delete',
      actorId,
      targetId: ruleId,
    })

    return ok(undefined)
  },
}
