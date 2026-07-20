import type { WhatsAppAiConfig } from '@prisma/client'
import type { WhatsAppAiConfigDTO } from '@/types/whatsapp-ai-config'

export function toWhatsAppAiConfigDTO(
  config: WhatsAppAiConfig,
): WhatsAppAiConfigDTO {
  return {
    id: config.id,
    workspaceId: config.workspaceId,
    model: config.model,
    systemPrompt: config.systemPrompt,
    active: config.active,
    readMedia: config.readMedia,
    hasApiKey: Boolean(config.encryptedOpenaiApiKey),
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  }
}
