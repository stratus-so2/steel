import type { WhatsAppContact } from '@prisma/client'
import type { WhatsAppContactDTO } from '@/types/whatsapp-contact'

export function toWhatsAppContactDTO(
  contact: WhatsAppContact,
): WhatsAppContactDTO {
  return {
    id: contact.id,
    workspaceId: contact.workspaceId,
    waId: contact.waId,
    name: contact.name,
    avatarUrl: contact.avatarUrl,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  }
}
