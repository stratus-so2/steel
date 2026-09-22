import z from 'zod'
import { sdName } from './sd-config.schema'
import { SdConditionsSchema, SdEscalationActionsSchema } from './sd-rule.schema'

export const SD_ESCALATION_TRIGGERS = [
  'FIRST_RESPONSE_AT_RISK',
  'FIRST_RESPONSE_BREACHED',
  'RESOLUTION_AT_RISK',
  'RESOLUTION_BREACHED',
  'NO_UPDATE',
] as const
export const SdEscalationTriggerEnum = z.enum(SD_ESCALATION_TRIGGERS)

const threshold = z.number().int().min(1).max(525_600)

export const CreateSdEscalationRuleSchema = z
  .object({
    name: sdName,
    trigger: SdEscalationTriggerEnum,
    /** NO_UPDATE: minutos sem atualização (obrigatório só nesse gatilho). */
    thresholdMinutes: threshold.nullable().optional(),
    conditions: SdConditionsSchema.default([]),
    actions: SdEscalationActionsSchema,
    active: z.boolean().default(true),
  })
  .refine((r) => r.trigger !== 'NO_UPDATE' || !!r.thresholdMinutes, {
    message: 'Informe os minutos sem atualização',
    path: ['thresholdMinutes'],
  })
export type CreateSdEscalationRuleDTO = z.infer<
  typeof CreateSdEscalationRuleSchema
>

export const UpdateSdEscalationRuleSchema = z
  .object({
    name: sdName.optional(),
    trigger: SdEscalationTriggerEnum.optional(),
    thresholdMinutes: threshold.nullable().optional(),
    conditions: SdConditionsSchema.optional(),
    actions: SdEscalationActionsSchema.optional(),
    active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo',
  })
export type UpdateSdEscalationRuleDTO = z.infer<
  typeof UpdateSdEscalationRuleSchema
>
