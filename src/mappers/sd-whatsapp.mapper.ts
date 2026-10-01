import type { WhatsAppConnection, WhatsAppTemplate } from '@prisma/client'
import { sdWhatsappMessageBody } from '@/src/lib/servicedesk/whatsapp'
import type {
  SdWaConversation,
  SdWaConversationListRow,
} from '@/src/repositories/sd-whatsapp.repository'
import type {
  SdWhatsappConnectionDTO,
  SdWhatsappConversationDTO,
  SdWhatsappTemplateDTO,
} from '@/types/sd-whatsapp'

/** Caminho do webhook a configurar no provedor. */
export function sdWhatsappWebhookPath(
  connection: Pick<WhatsAppConnection, 'provider' | 'webhookSecret'>,
): string {
  return connection.provider === 'ZAPI'
    ? `/api/whatsapp/webhook/zapi?secret=${encodeURIComponent(connection.webhookSecret)}`
    : '/api/whatsapp/webhook/meta'
}

export function toSdWhatsappConnectionDTO(
  connection: WhatsAppConnection,
  activeId: string | null,
): SdWhatsappConnectionDTO {
  return {
    id: connection.id,
    provider: connection.provider,
    label: connection.label,
    phoneNumber: connection.phoneNumber,
    status: connection.status,
    statusError: connection.statusError,
    zapiInstanceId: connection.zapiInstanceId,
    metaPhoneNumberId: connection.metaPhoneNumberId,
    metaWabaId: connection.metaWabaId,
    active: connection.id === activeId,
    webhookPath: sdWhatsappWebhookPath(connection),
    createdAt: connection.createdAt.toISOString(),
  }
}

export function toSdWhatsappConversationDTO(
  conversation: SdWaConversation | SdWaConversationListRow,
  prefixes?: (t: { type: string; number: number }) => string,
): SdWhatsappConversationDTO {
  const last = conversation.messages[0]
  const ticket =
    'sdTickets' in conversation ? (conversation.sdTickets[0] ?? null) : null
  return {
    id: conversation.id,
    connectionId: conversation.connectionId,
    contact: {
      id: conversation.contact.id,
      name: conversation.contact.name,
      waId: conversation.contact.waId,
      avatarUrl: conversation.contact.avatarUrl,
    },
    status: conversation.status,
    aiActive: conversation.aiActive,
    aiHandoff: conversation.aiHandoff,
    lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
    lastMessagePreview: last ? sdWhatsappMessageBody(last.type, last.text) : null,
    openTicket:
      ticket && prefixes
        ? { id: ticket.id, number: ticket.number, code: prefixes(ticket) }
        : null,
  }
}

interface TemplateComponent {
  type?: string
  text?: string
}

export function toSdWhatsappTemplateDTO(
  template: WhatsAppTemplate,
): SdWhatsappTemplateDTO {
  const components = Array.isArray(template.components)
    ? (template.components as TemplateComponent[])
    : []
  const body =
    components.find((c) => c?.type?.toUpperCase() === 'BODY')?.text ?? null
  const variables = new Set(body?.match(/\{\{\s*\d+\s*\}\}/g) ?? [])
  return {
    id: template.id,
    name: template.name,
    language: template.language,
    category: template.category,
    body,
    variableCount: variables.size,
  }
}
