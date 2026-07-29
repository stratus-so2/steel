import { z } from 'zod'

export const CreateWhatsAppBroadcastImportSchema = z.object({
  name: z.string().min(1).max(140),
  connectionId: z.string().min(1),
  templateId: z.string().min(1),
  sendOffsetHours: z
    .number()
    .int()
    .min(0)
    .max(24 * 30)
    .default(24),
  csv: z.string().min(1),
})

export type CreateWhatsAppBroadcastImportDTO = z.infer<
  typeof CreateWhatsAppBroadcastImportSchema
>
