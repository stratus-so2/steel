import type {
  CrmLead,
  CrmLeadRoutingRule,
  CrmLeadScoringRule,
} from '@prisma/client'
import type {
  CrmLeadDTO,
  CrmLeadRoutingRuleDTO,
  CrmLeadScoringRuleDTO,
} from '@/types/crm-lead'

export function toCrmLeadDTO(lead: CrmLead): CrmLeadDTO {
  return {
    id: lead.id,
    workspaceId: lead.workspaceId,
    name: lead.name,
    emails: lead.emails,
    phones: lead.phones,
    company: lead.company,
    jobTitle: lead.jobTitle,
    city: lead.city,
    linkedin: lead.linkedin,
    source: lead.source,
    channel: lead.channel,
    status: lead.status,
    score: lead.score,
    ownerId: lead.ownerId,
    convertedPersonId: lead.convertedPersonId,
    createdById: lead.createdById,
    updatedById: lead.updatedById,
    position: lead.position,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  }
}

export function toCrmLeadScoringRuleDTO(
  rule: CrmLeadScoringRule,
): CrmLeadScoringRuleDTO {
  return {
    id: rule.id,
    workspaceId: rule.workspaceId,
    field: rule.field,
    operator: rule.operator,
    value: rule.value,
    points: rule.points,
    active: rule.active,
    position: rule.position,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  }
}

export function toCrmLeadRoutingRuleDTO(
  rule: CrmLeadRoutingRule,
): CrmLeadRoutingRuleDTO {
  return {
    id: rule.id,
    workspaceId: rule.workspaceId,
    field: rule.field,
    operator: rule.operator,
    value: rule.value,
    ownerId: rule.ownerId,
    active: rule.active,
    position: rule.position,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  }
}
