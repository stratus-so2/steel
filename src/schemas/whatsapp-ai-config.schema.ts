import { z } from 'zod'

export const SaveWhatsAppAiConfigSchema = z.object({
  openaiApiKey: z.string().min(1).max(300).optional(),
  model: z.string().min(1).max(60).optional(),
  systemPrompt: z.string().min(1).max(4000).optional(),
  active: z.boolean().optional(),
})

export type SaveWhatsAppAiConfigDTO = z.infer<typeof SaveWhatsAppAiConfigSchema>
