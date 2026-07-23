import z from 'zod'

const TaskStatusEnum = z.enum(['TODO', 'IN_PROGRESS', 'DONE'])

export const CreateCrmTaskSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200),
  status: TaskStatusEnum.default('TODO'),
  body: z.string().max(5000).optional(),
  dueDate: z.coerce.date().optional(),
  assigneeId: z.string().optional(),
  companyId: z.string().optional(),
  personId: z.string().optional(),
  opportunityId: z.string().optional(),
})

export type CreateCrmTaskDTO = z.infer<typeof CreateCrmTaskSchema>

export const UpdateCrmTaskSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200).optional(),
  status: TaskStatusEnum.optional(),
  body: z.string().max(5000).optional(),
  dueDate: z.coerce.date().optional(),
  // Nullable: colunas limpáveis na grade (enviam null para desvincular).
  assigneeId: z.string().nullable().optional(),
  companyId: z.string().nullable().optional(),
  personId: z.string().nullable().optional(),
  opportunityId: z.string().nullable().optional(),
})

export type UpdateCrmTaskDTO = z.infer<typeof UpdateCrmTaskSchema>

export const ListCrmTasksSchema = z.object({
  companyId: z.string().optional(),
  personId: z.string().optional(),
  opportunityId: z.string().optional(),
  status: TaskStatusEnum.optional(),
})

export type ListCrmTasksDTO = z.infer<typeof ListCrmTasksSchema>

export const ReorderCrmTasksSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
})

export type ReorderCrmTasksDTO = z.infer<typeof ReorderCrmTasksSchema>
