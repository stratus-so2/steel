import z from 'zod'

const ReportSourceEnum = z.enum(['company', 'person', 'opportunity', 'lead'])

export const CreateCrmReportSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  source: ReportSourceEnum,
  columns: z.array(z.string()).min(1, 'Selecione ao menos uma coluna'),
  filters: z.record(z.string(), z.unknown()).default({}),
  groupBy: z.string().max(100).optional(),
  sort: z
    .object({ field: z.string(), direction: z.enum(['asc', 'desc']) })
    .optional(),
})

export type CreateCrmReportDTO = z.infer<typeof CreateCrmReportSchema>

export const UpdateCrmReportSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200).optional(),
  columns: z.array(z.string()).min(1).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  groupBy: z.string().max(100).optional(),
  sort: z
    .object({ field: z.string(), direction: z.enum(['asc', 'desc']) })
    .optional(),
})

export type UpdateCrmReportDTO = z.infer<typeof UpdateCrmReportSchema>

export const ReorderCrmReportsSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
})

export type ReorderCrmReportsDTO = z.infer<typeof ReorderCrmReportsSchema>
