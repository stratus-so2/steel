import z from 'zod'

export const CRM_SOCIAL_PLATFORMS = [
  'FACEBOOK',
  'INSTAGRAM',
  'TIKTOK',
  'YOUTUBE',
  'TWITTER',
  'LINKEDIN',
] as const

// Não há handshake OAuth real contra as APIs das plataformas (exige
// credenciais de app por plataforma, não fornecidas). O admin registra aqui
// os dados de uma conta já autorizada fora do Steel.
export const CreateCrmSocialConnectionSchema = z.object({
  platform: z.enum(CRM_SOCIAL_PLATFORMS),
  externalAccountId: z.string().min(1, 'ID da conta é obrigatório').max(200),
  accountName: z.string().max(200).optional(),
})

export type CreateCrmSocialConnectionDTO = z.infer<
  typeof CreateCrmSocialConnectionSchema
>

export const CreateCrmScheduledPostSchema = z.object({
  content: z.string().max(10_000).default(''),
  title: z.string().max(200).optional(),
  scheduledFor: z.coerce.date().optional(),
  platforms: z.array(z.enum(CRM_SOCIAL_PLATFORMS)).min(1),
})

export type CreateCrmScheduledPostDTO = z.infer<
  typeof CreateCrmScheduledPostSchema
>

export const UpdateCrmScheduledPostSchema = z.object({
  content: z.string().max(10_000).optional(),
  title: z.string().max(200).optional(),
  scheduledFor: z.coerce.date().optional(),
})

export type UpdateCrmScheduledPostDTO = z.infer<
  typeof UpdateCrmScheduledPostSchema
>
