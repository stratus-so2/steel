import z from 'zod'
import { sdId } from './sd-config.schema'

export const SdTaskStatusEnum = z.enum([
  'TODO',
  'IN_PROGRESS',
  'DONE',
  'CANCELED',
])

const title = z
  .string()
  .trim()
  .min(1, 'Título é obrigatório')
  .max(200, 'Título muito longo')
const description = z.string().trim().max(5000).nullable().optional()

export const CreateSdTicketTaskSchema = z.object({
  title,
  description,
  assigneeId: sdId.nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  status: SdTaskStatusEnum.default('TODO'),
})
export type CreateSdTicketTaskDTO = z.infer<typeof CreateSdTicketTaskSchema>

export const UpdateSdTicketTaskSchema = z
  .object({
    title: title.optional(),
    description,
    assigneeId: sdId.nullable().optional(),
    dueDate: z.coerce.date().nullable().optional(),
    status: SdTaskStatusEnum.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo',
  })
export type UpdateSdTicketTaskDTO = z.infer<typeof UpdateSdTicketTaskSchema>

export const ReorderSdTicketTasksSchema = z.object({
  orderedIds: z.array(sdId).min(1).max(500),
})
export type ReorderSdTicketTasksDTO = z.infer<typeof ReorderSdTicketTasksSchema>
