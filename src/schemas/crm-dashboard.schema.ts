import z from 'zod'

export const CreateCrmDashboardSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200),
})

export type CreateCrmDashboardDTO = z.infer<typeof CreateCrmDashboardSchema>

export const UpdateCrmDashboardSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200).optional(),
})

export type UpdateCrmDashboardDTO = z.infer<typeof UpdateCrmDashboardSchema>

export const ReorderCrmDashboardsSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
})

export type ReorderCrmDashboardsDTO = z.infer<typeof ReorderCrmDashboardsSchema>

const WidgetTypeEnum = z.enum(['CHART', 'VIEW', 'IFRAME', 'RICH_TEXT'])

export const CreateCrmDashboardWidgetSchema = z.object({
  type: WidgetTypeEnum,
  x: z.number().int().default(0),
  y: z.number().int().default(0),
  w: z.number().int().min(1).default(4),
  h: z.number().int().min(1).default(6),
  config: z.record(z.string(), z.unknown()).default({}),
})

export type CreateCrmDashboardWidgetDTO = z.infer<
  typeof CreateCrmDashboardWidgetSchema
>

export const UpdateCrmDashboardWidgetSchema = z.object({
  x: z.number().int().optional(),
  y: z.number().int().optional(),
  w: z.number().int().min(1).optional(),
  h: z.number().int().min(1).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
})

export type UpdateCrmDashboardWidgetDTO = z.infer<
  typeof UpdateCrmDashboardWidgetSchema
>
