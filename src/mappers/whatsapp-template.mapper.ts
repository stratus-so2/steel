import type { WhatsAppTemplate } from '@prisma/client'
import type { WhatsAppTemplateDTO } from '@/types/whatsapp-template'

export function toWhatsAppTemplateDTO(
  template: WhatsAppTemplate,
): WhatsAppTemplateDTO {
  return {
    id: template.id,
    workspaceId: template.workspaceId,
    connectionId: template.connectionId,
    name: template.name,
    language: template.language,
    category: template.category,
    status: template.status,
    components: Array.isArray(template.components) ? template.components : [],
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  }
}
