import z from 'zod'
import {
  booleanQuery,
  sdColor,
  sdDescription,
  sdId,
  sdName,
} from './sd-config.schema'

const email = z.email('E-mail inválido').max(200).nullable().optional()

export const CreateSdDepartmentSchema = z.object({
  name: sdName,
  description: sdDescription,
  email,
  color: sdColor,
  /** Departamento pai (sub-departamento). Só dois níveis. */
  parentId: sdId.nullable().optional(),
  calendarId: sdId.nullable().optional(),
  active: z.boolean().default(true),
})
export type CreateSdDepartmentDTO = z.infer<typeof CreateSdDepartmentSchema>

export const UpdateSdDepartmentSchema = z
  .object({
    name: sdName.optional(),
    description: sdDescription,
    email,
    color: sdColor,
    parentId: sdId.nullable().optional(),
    calendarId: sdId.nullable().optional(),
    active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo',
  })
export type UpdateSdDepartmentDTO = z.infer<typeof UpdateSdDepartmentSchema>

export const ListSdDepartmentsSchema = z.object({
  includeInactive: booleanQuery,
})
export type ListSdDepartmentsDTO = z.infer<typeof ListSdDepartmentsSchema>

export const AddSdDepartmentMemberSchema = z.object({
  userId: sdId,
  isLead: z.boolean().default(false),
})
export type AddSdDepartmentMemberDTO = z.infer<
  typeof AddSdDepartmentMemberSchema
>

export const UpdateSdDepartmentMemberSchema = z.object({
  isLead: z.boolean(),
})
export type UpdateSdDepartmentMemberDTO = z.infer<
  typeof UpdateSdDepartmentMemberSchema
>
