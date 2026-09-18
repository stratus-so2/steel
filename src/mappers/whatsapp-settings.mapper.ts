import type { WhatsAppSettings } from '@prisma/client'
import type { WhatsAppSettingsDTO } from '@/types/whatsapp-settings'

/** Padrões quando o workspace ainda não salvou configurações. */
export const WHATSAPP_SETTINGS_DEFAULTS = {
  autoCloseAfterHours: 24,
  sentimentAlertEnabled: true,
  sentimentAlertThreshold: -0.3,
  sentimentAlertNotifyInApp: true,
  sentimentAlertNotifyEmail: false,
  sentimentAlertRecipientIds: [] as string[],
  sentimentAlertAssignToId: null as string | null,
  sentimentAlertCooldownHours: 6,
}

export function toWhatsAppSettingsDTO(
  workspaceId: string,
  settings: WhatsAppSettings | null,
): WhatsAppSettingsDTO {
  if (!settings) {
    return {
      workspaceId,
      ...WHATSAPP_SETTINGS_DEFAULTS,
      sentimentAlertRecipientIds: [],
    }
  }
  return {
    workspaceId,
    autoCloseAfterHours: settings.autoCloseAfterHours,
    sentimentAlertEnabled: settings.sentimentAlertEnabled,
    sentimentAlertThreshold: settings.sentimentAlertThreshold,
    sentimentAlertNotifyInApp: settings.sentimentAlertNotifyInApp,
    sentimentAlertNotifyEmail: settings.sentimentAlertNotifyEmail,
    sentimentAlertRecipientIds: settings.sentimentAlertRecipientIds,
    sentimentAlertAssignToId: settings.sentimentAlertAssignToId,
    sentimentAlertCooldownHours: settings.sentimentAlertCooldownHours,
  }
}
