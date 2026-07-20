import type {
  WhatsAppBroadcastListWithCounts,
  WhatsAppBroadcastListWithRecipients,
} from '@/src/repositories/whatsapp-broadcast.repository'
import type {
  WhatsAppBroadcastListDetailDTO,
  WhatsAppBroadcastListDTO,
  WhatsAppBroadcastRecipientDTO,
} from '@/types/whatsapp-broadcast'

export function toWhatsAppBroadcastListDTO(
  list: WhatsAppBroadcastListWithCounts,
): WhatsAppBroadcastListDTO {
  return {
    id: list.id,
    workspaceId: list.workspaceId,
    connectionId: list.connectionId,
    name: list.name,
    messageBody: list.messageBody,
    mediaUrl: list.mediaUrl,
    status: list.status,
    scheduledAt: list.scheduledAt ? list.scheduledAt.toISOString() : null,
    createdById: list.createdById,
    recipientCount: list.recipients.length,
    sentCount: list.recipients.filter((r) => r.status === 'SENT').length,
    failedCount: list.recipients.filter((r) => r.status === 'FAILED').length,
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
  }
}

export function toWhatsAppBroadcastListDetailDTO(
  list: WhatsAppBroadcastListWithRecipients,
): WhatsAppBroadcastListDetailDTO {
  const recipients: WhatsAppBroadcastRecipientDTO[] = list.recipients.map(
    (recipient) => ({
      id: recipient.id,
      contactId: recipient.contactId,
      contactName: recipient.contact.name,
      contactWaId: recipient.contact.waId,
      status: recipient.status,
      errorMessage: recipient.errorMessage,
      sentAt: recipient.sentAt ? recipient.sentAt.toISOString() : null,
    }),
  )

  return {
    id: list.id,
    workspaceId: list.workspaceId,
    connectionId: list.connectionId,
    name: list.name,
    messageBody: list.messageBody,
    mediaUrl: list.mediaUrl,
    status: list.status,
    scheduledAt: list.scheduledAt ? list.scheduledAt.toISOString() : null,
    createdById: list.createdById,
    recipientCount: recipients.length,
    sentCount: recipients.filter((r) => r.status === 'SENT').length,
    failedCount: recipients.filter((r) => r.status === 'FAILED').length,
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
    recipients,
  }
}
