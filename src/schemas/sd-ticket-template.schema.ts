import z from 'zod'
import { booleanQuery, sdDescription, sdId, sdName } from './sd-config.schema'
import { SdTicketTypeEnum } from './sd-rule.schema'

export const SdChangeTypeEnum = z.enum(['STANDARD', 'NORMAL', 'EMERGENCY'])
export const SdRiskLevelEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'])

/** Valores aplicados ao chamado quando aberto pelo modelo. */
export const SdTicketTemplateDefaultsSchema = z
  .object({
    title: z.string().trim().max(200),
    description: z.string().max(20_000),
    categoryId: sdId,
    subcategoryId: sdId,
    serviceId: sdId,
    priorityId: sdId,
    impactId: sdId,
    urgencyId: sdId,
    severityId: sdId,
    classificationId: sdId,
    departmentId: sdId,
    changeType: SdChangeTypeEnum,
    changeRisk: SdRiskLevelEnum,
    implementationPlan: z.string().max(20_000),
    rollbackPlan: z.string().max(20_000),
    testPlan: z.string().max(20_000),
    tags: z.array(z.string().trim().min(1).max(50)).max(30),
    customFields: z.record(z.string(), z.unknown()),
  })
  .partial()
  .strict()
export type SdTicketTemplateDefaults = z.infer<
  typeof SdTicketTemplateDefaultsSchema
>

export const SdTicketTemplateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
})

const tasks = z.array(SdTicketTemplateTaskSchema).max(100)

export const CreateSdTicketTemplateSchema = z.object({
  ticketType: SdTicketTypeEnum,
  name: sdName,
  description: sdDescription,
  defaults: SdTicketTemplateDefaultsSchema.default({}),
  tasks: tasks.default([]),
  portalVisible: z.boolean().default(false),
  active: z.boolean().default(true),
})
export type CreateSdTicketTemplateDTO = z.infer<
  typeof CreateSdTicketTemplateSchema
>

export const UpdateSdTicketTemplateSchema = z
  .object({
    name: sdName.optional(),
    description: sdDescription,
    defaults: SdTicketTemplateDefaultsSchema.optional(),
    tasks: tasks.optional(),
    portalVisible: z.boolean().optional(),
    active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo',
  })
export type UpdateSdTicketTemplateDTO = z.infer<
  typeof UpdateSdTicketTemplateSchema
>

export const ListSdTicketTemplatesSchema = z.object({
  ticketType: SdTicketTypeEnum.optional(),
  includeInactive: booleanQuery,
})
export type ListSdTicketTemplatesDTO = z.infer<
  typeof ListSdTicketTemplatesSchema
>
