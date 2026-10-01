import type {
  WhatsAppConnectionStatusDTO,
  WhatsAppProviderDTO,
} from './whatsapp-connection'
import type { WhatsAppMessageDTO } from './whatsapp-message'

/**
 * Conexão do WhatsApp do ServiceDesk (`module = SERVICE_DESK`) vista pelos
 * admins do módulo, com o endereço do webhook a configurar no provedor.
 */
export interface SdWhatsappConnectionDTO {
  id: string
  provider: WhatsAppProviderDTO
  label: string
  phoneNumber: string
  status: WhatsAppConnectionStatusDTO
  statusError: string | null
  zapiInstanceId: string | null
  metaPhoneNumberId: string | null
  metaWabaId: string | null
  /** É a conexão ativa do ServiceDesk (`SdSettings.whatsappConnectionId`). */
  active: boolean
  /**
   * Caminho do webhook (sem o domínio). Z-API: com o segredo da conexão
   * (`?secret=`); Meta: a URL única da plataforma (token de verificação e
   * segredo do app são da plataforma).
   */
  webhookPath: string
  createdAt: string
}

export interface SdWhatsappConnectionTestDTO {
  connected: boolean
  status: WhatsAppConnectionStatusDTO
  error: string | null
}

export interface SdWhatsappQrCodeDTO {
  status: 'connected' | 'awaiting_scan'
  qrCodeBase64?: string
}

export interface SdWhatsappWindowDTO {
  open: boolean
  expiresAt: string | null
  requiresTemplate: boolean
}

export interface SdWhatsappConversationDTO {
  id: string
  connectionId: string
  contact: {
    id: string
    name: string | null
    waId: string
    avatarUrl: string | null
  }
  status: 'NEW' | 'IN_PROGRESS' | 'CLOSED'
  /** A IA do ServiceDesk está atendendo (pré-atendimento/resposta automática). */
  aiActive: boolean
  /** Transbordo para humano (a IA não responde mais nesta conversa). */
  aiHandoff: boolean
  lastMessageAt: string | null
  lastMessagePreview: string | null
  /** Chamado em aberto vinculado (outro que não o atual, na listagem). */
  openTicket: { id: string; number: number; code: string } | null
}

/** Estado da aba WhatsApp de um chamado. */
export interface SdTicketWhatsappDTO {
  /** Há conexão ativa do ServiceDesk configurada. */
  configured: boolean
  connection: {
    id: string
    label: string
    provider: WhatsAppProviderDTO
    phoneNumber: string
    status: WhatsAppConnectionStatusDTO
  } | null
  conversation: SdWhatsappConversationDTO | null
  window: SdWhatsappWindowDTO
  /** WhatsApp do contato do chamado (para iniciar a conversa). */
  suggestedWaId: string | null
}

export type SdWhatsappMessageDTO = WhatsAppMessageDTO

export interface SdWhatsappTemplateDTO {
  id: string
  name: string
  language: string
  category: string
  /** Texto do corpo (com as variáveis `{{1}}`…). */
  body: string | null
  variableCount: number
}
