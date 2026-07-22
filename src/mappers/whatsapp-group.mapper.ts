import type { WhatsAppGroupWithParticipants } from '@/src/repositories/whatsapp-group.repository'
import type { WhatsAppGroupDTO } from '@/types/whatsapp-group'

function previewForType(type: string): string {
  switch (type) {
    case 'IMAGE':
      return '📷 Imagem'
    case 'AUDIO':
      return '🎤 Áudio'
    case 'VIDEO':
      return '🎥 Vídeo'
    case 'DOCUMENT':
      return '📄 Documento'
    case 'STICKER':
      return 'Figurinha'
    case 'CONTACT':
      return 'Contato'
    default:
      return ''
  }
}

export function toWhatsAppGroupDTO(
  group: WhatsAppGroupWithParticipants,
): WhatsAppGroupDTO {
  const lastMessage = group.messages[0]

  return {
    id: group.id,
    workspaceId: group.workspaceId,
    connectionId: group.connectionId,
    groupJid: group.groupJid,
    name: group.name,
    imageUrl: group.imageUrl,
    description: group.description,
    inviteLink: group.inviteLink,
    archived: group.archivedAt !== null,
    lastMessageAt: group.lastMessageAt
      ? group.lastMessageAt.toISOString()
      : null,
    lastMessagePreview: lastMessage
      ? (lastMessage.text ?? previewForType(lastMessage.type))
      : null,
    participants: group.participants.map((p) => ({
      waId: p.waId,
      name: p.name,
      role: p.role,
    })),
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  }
}
