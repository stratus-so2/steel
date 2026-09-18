export interface WhatsAppSettingsDTO {
  workspaceId: string
  /** 0 = fechamento automático desligado. */
  autoCloseAfterHours: number
  sentimentAlertEnabled: boolean
  /** Média da conversa (-1 a 0) a partir da qual o alerta dispara. */
  sentimentAlertThreshold: number
  sentimentAlertNotifyInApp: boolean
  sentimentAlertNotifyEmail: boolean
  /** Vazio = todos os OWNER/ADMIN. */
  sentimentAlertRecipientIds: string[]
  sentimentAlertAssignToId: string | null
  sentimentAlertCooldownHours: number
}
