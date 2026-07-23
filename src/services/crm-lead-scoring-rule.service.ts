import { auditMutation } from '@/lib/axiom/audit'
import { ok, type Result } from '@/src/lib/result'
import { toCrmLeadScoringRuleDTO } from '@/src/mappers/crm-lead.mapper'
import { CrmLeadScoringRuleRepository } from '@/src/repositories/crm-lead-scoring-rule.repository'
import type {
  CreateCrmLeadScoringRuleDTO,
  UpdateCrmLeadScoringRuleDTO,
} from '@/src/schemas/crm-lead.schema'
import type { CrmLeadScoringRuleDTO } from '@/types/crm-lead'
import { assertMember } from './authz'

export const CrmLeadScoringRuleService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<CrmLeadScoringRuleDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result =
      await CrmLeadScoringRuleRepository.listByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmLeadScoringRuleDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmLeadScoringRuleDTO,
  ): Promise<Result<CrmLeadScoringRuleDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmLeadScoringRuleRepository.create({
      workspaceId,
      field: dto.field,
      operator: dto.operator,
      value: dto.value,
      points: dto.points,
      active: dto.active,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_lead_scoring_rule',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_lead_scoring_rule',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toCrmLeadScoringRuleDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    ruleId: string,
    dto: UpdateCrmLeadScoringRuleDTO,
  ): Promise<Result<CrmLeadScoringRuleDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmLeadScoringRuleRepository.findById(
      ruleId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmLeadScoringRuleRepository.update(ruleId, dto)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_lead_scoring_rule',
      action: 'update',
      actorId,
      targetId: ruleId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toCrmLeadScoringRuleDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    ruleId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmLeadScoringRuleRepository.findById(
      ruleId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmLeadScoringRuleRepository.delete(ruleId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_lead_scoring_rule',
      action: 'delete',
      actorId,
      targetId: ruleId,
    })

    return ok(undefined)
  },
}
