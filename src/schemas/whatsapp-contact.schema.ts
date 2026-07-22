import { z } from 'zod'

const WaIdField = z
  .string()
  .min(8, 'Número inválido')
  .max(20)
  .regex(/^\d+$/, 'Informe apenas dígitos, com DDI e DDD')

export const CreateWhatsAppContactSchema = z.object({
  waId: WaIdField,
  name: z.string().min(1).max(120).optional(),
  avatarUrl: z.url().max(2048).optional(),
})

export type CreateWhatsAppContactDTO = z.infer<
  typeof CreateWhatsAppContactSchema
>

export const UpdateWhatsAppContactSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  avatarUrl: z.url().max(2048).optional(),
})

export type UpdateWhatsAppContactDTO = z.infer<
  typeof UpdateWhatsAppContactSchema
>

export const FindOrCreateWhatsAppContactSchema = z.object({
  waId: WaIdField,
  name: z.string().min(1).max(120).optional(),
})

export type FindOrCreateWhatsAppContactDTO = z.infer<
  typeof FindOrCreateWhatsAppContactSchema
>

export const ListWhatsAppContactsSchema = z.object({
  search: z.string().max(120).optional(),
})

export type ListWhatsAppContactsDTO = z.infer<typeof ListWhatsAppContactsSchema>
