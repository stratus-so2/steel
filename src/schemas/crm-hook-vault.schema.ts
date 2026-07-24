import z from 'zod'
import { CRM_SOCIAL_PLATFORMS } from '@/src/schemas/crm-social.schema'

export const CreateCrmHookVaultItemSchema = z.object({
  text: z.string().trim().min(1, 'Informe o texto do hook').max(2000),
  platform: z.enum(CRM_SOCIAL_PLATFORMS).nullable().optional(),
  usageCount: z.number().int().min(0).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
})

export type CreateCrmHookVaultItemDTO = z.infer<
  typeof CreateCrmHookVaultItemSchema
>

export const UpdateCrmHookVaultItemSchema = z
  .object({
    text: z.string().trim().min(1, 'Informe o texto do hook').max(2000),
    platform: z.enum(CRM_SOCIAL_PLATFORMS).nullable(),
    usageCount: z.number().int().min(0),
    notes: z.string().trim().max(2000).nullable(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualizar',
  })

export type UpdateCrmHookVaultItemDTO = z.infer<
  typeof UpdateCrmHookVaultItemSchema
>

export const ReorderCrmHookVaultItemsSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
})

export type ReorderCrmHookVaultItemsDTO = z.infer<
  typeof ReorderCrmHookVaultItemsSchema
>
