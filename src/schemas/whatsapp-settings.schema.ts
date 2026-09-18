import { z } from 'zod'

/** Limite de 30 dias para o fechamento automático por inatividade. */
export const WHATSAPP_AUTO_CLOSE_MAX_HOURS = 720

export const UpdateWhatsAppSettingsSchema = z.object({
  autoCloseAfterHours: z
    .number()
    .int('Informe um número inteiro de horas')
    .min(0, 'Use 0 para desligar o fechamento automático')
    .max(
      WHATSAPP_AUTO_CLOSE_MAX_HOURS,
      `Máximo de ${WHATSAPP_AUTO_CLOSE_MAX_HOURS} horas (30 dias)`,
    )
    .optional(),
})

export type UpdateWhatsAppSettingsDTO = z.infer<
  typeof UpdateWhatsAppSettingsSchema
>
