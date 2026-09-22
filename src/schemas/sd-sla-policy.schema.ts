import z from 'zod'
import { sdDescription, sdId, sdName } from './sd-config.schema'
import { SdConditionsSchema } from './sd-rule.schema'

/** Um ano em minutos — teto das metas. */
const MAX_MINUTES = 525_600

export const SdSlaTargetSchema = z
  .object({
    priorityId: sdId,
    firstResponseMinutes: z.number().int().min(1).max(MAX_MINUTES),
    resolutionMinutes: z.number().int().min(1).max(MAX_MINUTES),
  })
  .refine((t) => t.resolutionMinutes >= t.firstResponseMinutes, {
    message:
      'A meta de resolução não pode ser menor que a de primeira resposta',
    path: ['resolutionMinutes'],
  })
export type SdSlaTargetInput = z.infer<typeof SdSlaTargetSchema>

export const SdSlaTargetsSchema = z
  .array(SdSlaTargetSchema)
  .max(50)
  .refine(
    (list) => new Set(list.map((t) => t.priorityId)).size === list.length,
    { message: 'Cada prioridade pode ter uma única meta' },
  )

export const SdSlaKindEnum = z.enum(['SLA', 'OLA'])

export const CreateSdSlaPolicySchema = z.object({
  kind: SdSlaKindEnum.default('SLA'),
  name: sdName,
  description: sdDescription,
  calendarId: sdId.nullable().optional(),
  conditions: SdConditionsSchema.default([]),
  isDefault: z.boolean().default(false),
  active: z.boolean().default(true),
  targets: SdSlaTargetsSchema.default([]),
})
export type CreateSdSlaPolicyDTO = z.infer<typeof CreateSdSlaPolicySchema>

export const UpdateSdSlaPolicySchema = z
  .object({
    kind: SdSlaKindEnum.optional(),
    name: sdName.optional(),
    description: sdDescription,
    calendarId: sdId.nullable().optional(),
    conditions: SdConditionsSchema.optional(),
    isDefault: z.boolean().optional(),
    active: z.boolean().optional(),
    /** Quando enviado, substitui todas as metas da política. */
    targets: SdSlaTargetsSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo',
  })
export type UpdateSdSlaPolicyDTO = z.infer<typeof UpdateSdSlaPolicySchema>
