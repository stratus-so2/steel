import z from 'zod'
import {
  booleanQuery,
  SdPhaseCategoryEnum,
  sdColor,
  sdDescription,
  sdId,
  sdName,
} from './sd-config.schema'
import { SdTicketTypeEnum } from './sd-rule.schema'

/**
 * Campos do chamado que uma fase pode exigir preenchidos para entrar
 * (`SdPhase.requiredFields`), além de `customFields.<chave>`.
 */
export const SD_PHASE_REQUIRED_FIELDS = [
  'description',
  'impactId',
  'urgencyId',
  'priorityId',
  'severityId',
  'categoryId',
  'subcategoryId',
  'serviceId',
  'classificationId',
  'solutionClassificationId',
  'solution',
  'customerId',
  'companyId',
  'contactId',
  'configItemId',
  'departmentId',
  'assigneeId',
  'changeType',
  'changeRisk',
  'plannedStartAt',
  'plannedEndAt',
  'implementationPlan',
  'rollbackPlan',
  'testPlan',
  'rootCause',
  'workaround',
] as const

export const SdPhaseRequiredFieldSchema = z.union([
  z.enum(SD_PHASE_REQUIRED_FIELDS),
  z
    .string()
    .regex(
      /^customFields\.[a-zA-Z][a-zA-Z0-9_]{0,63}$/,
      'Campo obrigatório inválido',
    ),
])

const requiredFields = z
  .array(SdPhaseRequiredFieldSchema)
  .max(40)
  .transform((fields) => [...new Set(fields)])

const percent = z
  .number()
  .int()
  .min(0, 'O percentual vai de 0 a 100')
  .max(100, 'O percentual vai de 0 a 100')

const wipLimit = z.number().int().min(0).max(10_000)

export const CreateSdPhaseSchema = z.object({
  ticketType: SdTicketTypeEnum,
  name: sdName,
  description: sdDescription,
  color: sdColor,
  category: SdPhaseCategoryEnum,
  completionPercent: percent.default(0),
  isInitial: z.boolean().default(false),
  pausesSla: z.boolean().default(false),
  requiresApproval: z.boolean().default(false),
  requiredFields: requiredFields.default([]),
  wipLimit: wipLimit.default(0),
  active: z.boolean().default(true),
})
export type CreateSdPhaseDTO = z.infer<typeof CreateSdPhaseSchema>

export const UpdateSdPhaseSchema = z
  .object({
    name: sdName.optional(),
    description: sdDescription,
    color: sdColor,
    category: SdPhaseCategoryEnum.optional(),
    completionPercent: percent.optional(),
    isInitial: z.boolean().optional(),
    pausesSla: z.boolean().optional(),
    requiresApproval: z.boolean().optional(),
    requiredFields: requiredFields.optional(),
    wipLimit: wipLimit.optional(),
    active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo',
  })
export type UpdateSdPhaseDTO = z.infer<typeof UpdateSdPhaseSchema>

export const ListSdPhasesSchema = z.object({
  ticketType: SdTicketTypeEnum.optional(),
  includeInactive: booleanQuery,
})
export type ListSdPhasesDTO = z.infer<typeof ListSdPhasesSchema>

export const ReorderSdPhasesSchema = z.object({
  ticketType: SdTicketTypeEnum,
  orderedIds: z.array(sdId).min(1).max(200),
})
export type ReorderSdPhasesDTO = z.infer<typeof ReorderSdPhasesSchema>

export const SdPhaseTransitionsQuerySchema = z.object({
  type: SdTicketTypeEnum,
})

export const SdPhaseTransitionInputSchema = z
  .object({
    fromPhaseId: sdId,
    toPhaseId: sdId,
    /** Restringe a transição a membros destes departamentos (vazio = todos). */
    allowedDepartmentIds: z
      .array(sdId)
      .max(100)
      .transform((ids) => [...new Set(ids)])
      .default([]),
  })
  .refine((t) => t.fromPhaseId !== t.toPhaseId, {
    message: 'Uma transição precisa ligar fases diferentes',
    path: ['toPhaseId'],
  })

/** Matriz completa do tipo (substitui a atual; lista vazia = fluxo livre). */
export const SaveSdPhaseTransitionsSchema = z.object({
  transitions: z
    .array(SdPhaseTransitionInputSchema)
    .max(2000)
    .refine(
      (list) =>
        new Set(list.map((t) => `${t.fromPhaseId}>${t.toPhaseId}`)).size ===
        list.length,
      { message: 'Há transições repetidas' },
    ),
})
export type SaveSdPhaseTransitionsDTO = z.infer<
  typeof SaveSdPhaseTransitionsSchema
>
