import type { WhatsAppConnection } from '@prisma/client'
import type {
  WhatsAppConnectionCreatedDTO,
  WhatsAppConnectionDTO,
} from '@/types/whatsapp-connection'

export function toWhatsAppConnectionDTO(
  connection: WhatsAppConnection,
): WhatsAppConnectionDTO {
  return {
    id: connection.id,
    workspaceId: connection.workspaceId,
    provider: connection.provider,
    label: connection.label,
    phoneNumber: connection.phoneNumber,
    status: connection.status,
    statusError: connection.statusError,
    zapiInstanceId: connection.zapiInstanceId,
    metaPhoneNumberId: connection.metaPhoneNumberId,
    metaWabaId: connection.metaWabaId,
    createdById: connection.createdById,
    createdAt: connection.createdAt.toISOString(),
    updatedAt: connection.updatedAt.toISOString(),
  }
}

export function toWhatsAppConnectionCreatedDTO(
  connection: WhatsAppConnection,
): WhatsAppConnectionCreatedDTO {
  return {
    ...toWhatsAppConnectionDTO(connection),
    webhookSecret: connection.webhookSecret,
  }
}
