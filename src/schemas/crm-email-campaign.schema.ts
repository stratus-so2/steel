import z from 'zod'

export const CreateCrmEmailCampaignSchema = z.object({
  subject: z.string().min(1, 'Assunto é obrigatório').max(300),
  contentHtml: z.string().min(1, 'Conteúdo é obrigatório').max(200_000),
  contentJson: z.string().max(200_000).optional(),
  fromAddress: z.email(),
  recipientScope: z.enum(['ALL', 'SELECTED']),
  // Quando SELECTED, os três conjuntos abaixo são unidos (dedupe por
  // e-mail) — combinar pessoas + várias listas + e-mails avulsos numa
  // campanha só, igual ao original.
  mailingListIds: z.array(z.string()).optional(),
  personIds: z.array(z.string()).optional(),
  extraEmails: z.array(z.email()).optional(),
  scheduledAt: z.coerce.date().optional(),
})

export type CreateCrmEmailCampaignDTO = z.infer<
  typeof CreateCrmEmailCampaignSchema
>

export const UpdateCrmEmailCampaignSchema = z.object({
  subject: z.string().min(1, 'Assunto é obrigatório').max(300).optional(),
  contentHtml: z.string().min(1).max(200_000).optional(),
  contentJson: z.string().max(200_000).optional(),
  fromAddress: z.email().optional(),
  scheduledAt: z.coerce.date().optional(),
})

export type UpdateCrmEmailCampaignDTO = z.infer<
  typeof UpdateCrmEmailCampaignSchema
>
