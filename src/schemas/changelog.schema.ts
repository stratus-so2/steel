import { z } from 'zod'

const ChangelogItemSchema = z.object({
  title: z.string().trim().min(1, 'Título é obrigatório').max(200),
  body: z.string().trim().min(1, 'Texto é obrigatório').max(5000),
  imageUrl: z.url().max(2048).optional(),
})

export type ChangelogItemDTO = z.infer<typeof ChangelogItemSchema>

const EmailSchema = z.email().max(320)

export const CreateChangelogSchema = z.object({
  subject: z.string().trim().min(1, 'Assunto é obrigatório').max(200),
  items: z.array(ChangelogItemSchema).min(1, 'Adicione ao menos um item'),
  userIds: z.array(z.string().min(1)).max(5000).default([]),
  emails: z.array(EmailSchema).max(5000).default([]),
})

export type CreateChangelogDTO = z.infer<typeof CreateChangelogSchema>
