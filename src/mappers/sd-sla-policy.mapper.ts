import type { SdSlaPolicyWithTargets } from '@/src/repositories/sd-sla-policy.repository'
import type { SdCondition } from '@/src/schemas/sd-rule.schema'
import { SdConditionsSchema } from '@/src/schemas/sd-rule.schema'
import type { SdSlaPolicyDTO, SdSlaPolicySummaryDTO } from '@/types/sd-config'

/** JSON salvo → condições válidas (JSON corrompido vira lista vazia). */
export function toSdConditions(value: unknown): SdCondition[] {
  const parsed = SdConditionsSchema.safeParse(value)
  return parsed.success ? parsed.data : []
}

export function toSdSlaPolicyDTO(
  policy: SdSlaPolicyWithTargets,
): SdSlaPolicyDTO {
  return {
    id: policy.id,
    kind: policy.kind,
    name: policy.name,
    description: policy.description,
    calendarId: policy.calendarId,
    conditions: toSdConditions(policy.conditions),
    isDefault: policy.isDefault,
    active: policy.active,
    position: policy.position,
    targets: policy.targets.map((t) => ({
      priorityId: t.priorityId,
      firstResponseMinutes: t.firstResponseMinutes,
      resolutionMinutes: t.resolutionMinutes,
    })),
    createdAt: policy.createdAt.toISOString(),
    updatedAt: policy.updatedAt.toISOString(),
  }
}

export function toSdSlaPolicySummaryDTO(
  policy: Pick<
    SdSlaPolicyDTO,
    'id' | 'kind' | 'name' | 'isDefault' | 'active' | 'calendarId'
  >,
): SdSlaPolicySummaryDTO {
  return {
    id: policy.id,
    kind: policy.kind,
    name: policy.name,
    isDefault: policy.isDefault,
    active: policy.active,
    calendarId: policy.calendarId,
  }
}
