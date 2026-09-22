import type { SdEscalationRule } from '@prisma/client'
import {
  type SdEscalationActions,
  SdEscalationActionsSchema,
} from '@/src/schemas/sd-rule.schema'
import type { SdEscalationRuleDTO } from '@/types/sd-config'
import { toSdConditions } from './sd-sla-policy.mapper'

/** JSON salvo → ações de escalonamento (inválido vira o padrão hierárquico). */
export function toSdEscalationActions(value: unknown): SdEscalationActions {
  const parsed = SdEscalationActionsSchema.safeParse(value)
  return parsed.success ? parsed.data : SdEscalationActionsSchema.parse({})
}

export function toSdEscalationRuleDTO(
  rule: SdEscalationRule,
): SdEscalationRuleDTO {
  return {
    id: rule.id,
    name: rule.name,
    trigger: rule.trigger,
    thresholdMinutes: rule.thresholdMinutes,
    conditions: toSdConditions(rule.conditions),
    actions: toSdEscalationActions(rule.actions),
    active: rule.active,
    position: rule.position,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  }
}
