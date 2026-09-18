import { z } from 'zod'

/** Limite de 30 dias para o fechamento automático por inatividade. */
export const WHATSAPP_AUTO_CLOSE_MAX_HOURS = 720
/** Intervalo mínimo entre alertas de sentimento da mesma conversa. */
export const WHATSAPP_SENTIMENT_ALERT_MAX_COOLDOWN_HOURS = 168

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

  sentimentAlertEnabled: z.boolean().optional(),
  /** Média de sentimento da conversa (-1 a 1) que dispara o alerta. */
  sentimentAlertThreshold: z
    .number()
    .min(-1, 'O limite vai de -1 (muito negativo) a 0 (neutro)')
    .max(0, 'O limite vai de -1 (muito negativo) a 0 (neutro)')
    .optional(),
  sentimentAlertNotifyInApp: z.boolean().optional(),
  sentimentAlertNotifyEmail: z.boolean().optional(),
  /** Vazio = todos os proprietários e administradores. */
  sentimentAlertRecipientIds: z
    .array(z.string().min(1))
    .max(50, 'Selecione no máximo 50 membros')
    .optional(),
  sentimentAlertAssignToId: z.string().min(1).nullable().optional(),
  sentimentAlertCooldownHours: z
    .number()
    .int('Informe um número inteiro de horas')
    .min(1, 'O intervalo mínimo é de 1 hora')
    .max(
      WHATSAPP_SENTIMENT_ALERT_MAX_COOLDOWN_HOURS,
      `Máximo de ${WHATSAPP_SENTIMENT_ALERT_MAX_COOLDOWN_HOURS} horas (7 dias)`,
    )
    .optional(),
})

export type UpdateWhatsAppSettingsDTO = z.infer<
  typeof UpdateWhatsAppSettingsSchema
>
