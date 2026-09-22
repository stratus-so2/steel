import z from 'zod'
import { sdId } from './sd-config.schema'

const title = z.string().trim().min(1, 'Título é obrigatório').max(120)
const shortcut = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9_-]{1,30}$/, 'Atalho: até 30 letras, números, - ou _')
  .nullable()
  .optional()
const body = z.string().trim().min(1, 'Texto é obrigatório').max(10_000)

export const CreateSdCannedResponseSchema = z.object({
  title,
  shortcut,
  body,
  /** Departamento dono (vazio = todos os agentes). */
  departmentId: sdId.nullable().optional(),
})
export type CreateSdCannedResponseDTO = z.infer<
  typeof CreateSdCannedResponseSchema
>

export const UpdateSdCannedResponseSchema = z
  .object({
    title: title.optional(),
    shortcut,
    body: body.optional(),
    departmentId: sdId.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo',
  })
export type UpdateSdCannedResponseDTO = z.infer<
  typeof UpdateSdCannedResponseSchema
>

export const ListSdCannedResponsesSchema = z.object({
  /** Respostas do departamento + as gerais (sem departamento). */
  departmentId: sdId.optional(),
  q: z.string().trim().max(100).optional(),
})
export type ListSdCannedResponsesDTO = z.infer<
  typeof ListSdCannedResponsesSchema
>
