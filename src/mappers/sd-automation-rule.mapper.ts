import type { SdAutomationRule } from '@prisma/client'
import z from 'zod'
import {
  type SdAutomationAction,
  SdAutomationActionSchema,
} from '@/src/schemas/sd-rule.schema'
import type { SdAutomationRuleDTO } from '@/types/sd-config'
import { toSdConditions } from './sd-sla-policy.mapper'

/** JSON salvo → ações de automação válidas (itens inválidos são descartados). */
export function toSdAutomationActions(value: unknown): SdAutomationAction[] {
  const parsed = z.array(z.unknown()).safeParse(value)
  if (!parsed.success) return []
  return parsed.data.flatMap((item) => {
    const action = SdAutomationActionSchema.safeParse(item)
    return action.success ? [action.data] : []
  })
}

export function toSdAutomationRuleDTO(
  rule: SdAutomationRule,
): SdAutomationRuleDTO {
  return {
    id: rule.id,
    name: rule.name,
    description: rule.description,
    event: rule.event,
    conditions: toSdConditions(rule.conditions),
    actions: toSdAutomationActions(rule.actions),
    stopProcessing: rule.stopProcessing,
    active: rule.active,
    position: rule.position,
    runCount: rule.runCount,
    lastRunAt: rule.lastRunAt?.toISOString() ?? null,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  }
}
