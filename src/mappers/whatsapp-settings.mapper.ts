import type { WhatsAppSettings } from '@prisma/client'
import type { WhatsAppSettingsDTO } from '@/types/whatsapp-settings'

/** Padrões quando o workspace ainda não salvou configurações. */
export const WHATSAPP_SETTINGS_DEFAULTS = {
  autoCloseAfterHours: 24,
} as const

export function toWhatsAppSettingsDTO(
  workspaceId: string,
  settings: WhatsAppSettings | null,
): WhatsAppSettingsDTO {
  return {
    workspaceId,
    autoCloseAfterHours:
      settings?.autoCloseAfterHours ??
      WHATSAPP_SETTINGS_DEFAULTS.autoCloseAfterHours,
  }
}
