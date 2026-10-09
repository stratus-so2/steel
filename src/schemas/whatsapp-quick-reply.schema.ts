import { z } from 'zod'

// Agents type `/shortcut` in the composer, so a shortcut saved as `/saudacao`
// would need `//saudacao`: the leading slash is dropped here. Spaces would end
// the slash command in the composer, so they are refused.
// `overwrite` (not `transform`) keeps the schema a plain string, so the
// OpenAPI document still shows its limits.
const ShortcutSchema = z
  .string()
  .trim()
  .overwrite((value) => value.replace(/^\/+/, ''))
  .min(1, 'Atalho é obrigatório')
  .max(50)
  .regex(/^\S+$/, 'O atalho não pode ter espaços')

export const CreateWhatsAppQuickReplySchema = z.object({
  shortcut: ShortcutSchema,
  title: z.string().min(1, 'Título é obrigatório').max(120),
  body: z.string().min(1, 'Mensagem é obrigatória').max(4096),
  mediaUrl: z.url().max(2048).optional(),
})

export type CreateWhatsAppQuickReplyDTO = z.infer<
  typeof CreateWhatsAppQuickReplySchema
>

export const UpdateWhatsAppQuickReplySchema = z.object({
  shortcut: ShortcutSchema.optional(),
  title: z.string().min(1).max(120).optional(),
  body: z.string().min(1).max(4096).optional(),
  mediaUrl: z.url().max(2048).optional(),
})

export type UpdateWhatsAppQuickReplyDTO = z.infer<
  typeof UpdateWhatsAppQuickReplySchema
>
