import z from 'zod'
import { CRM_SOCIAL_PLATFORMS } from '@/src/schemas/crm-social.schema'

export const CreateCrmCompetitorSchema = z.object({
  platform: z.enum(CRM_SOCIAL_PLATFORMS),
  handle: z.string().trim().min(1, 'Informe o @ ou nome do perfil').max(200),
  profileUrl: z.url('Informe uma URL válida').max(500).nullable().optional(),
  followersCount: z.number().int().min(0).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
})

export type CreateCrmCompetitorDTO = z.infer<typeof CreateCrmCompetitorSchema>

export const UpdateCrmCompetitorSchema = z
  .object({
    platform: z.enum(CRM_SOCIAL_PLATFORMS),
    handle: z.string().trim().min(1, 'Informe o @ ou nome do perfil').max(200),
    profileUrl: z.url('Informe uma URL válida').max(500).nullable(),
    followersCount: z.number().int().min(0).nullable(),
    notes: z.string().trim().max(2000).nullable(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualizar',
  })

export type UpdateCrmCompetitorDTO = z.infer<typeof UpdateCrmCompetitorSchema>

export const ReorderCrmCompetitorsSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
})

export type ReorderCrmCompetitorsDTO = z.infer<
  typeof ReorderCrmCompetitorsSchema
>
