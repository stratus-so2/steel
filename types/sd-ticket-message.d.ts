import type { SdUserSummaryDTO } from './sd-ticket'

export type SdMessageAuthorKindDTO =
  | 'AGENT'
  | 'REQUESTER'
  | 'CONTACT'
  | 'AI'
  | 'SYSTEM'

/** INTERNAL = nota interna (só agentes). */
export type SdMessageVisibilityDTO = 'PUBLIC' | 'INTERNAL'

export type SdMessageChannelDTO = 'PLATFORM' | 'WHATSAPP' | 'EMAIL'

export type SdAttachmentKindDTO =
  | 'IMAGE'
  | 'VIDEO'
  | 'AUDIO'
  | 'DOCUMENT'
  | 'OTHER'

export interface SdTicketAttachmentDTO {
  id: string
  ticketId: string
  /** `null` = enviado e ainda não preso a uma mensagem. */
  messageId: string | null
  kind: SdAttachmentKindDTO
  fileName: string
  mimeType: string
  /** Bytes. */
  size: number
  uploadedBy: SdUserSummaryDTO | null
  /** Rota autenticada que serve o arquivo (`?download=1` força o download). */
  url: string
  createdAt: string
}

export interface SdTicketMessageDTO {
  id: string
  ticketId: string
  authorKind: SdMessageAuthorKindDTO
  author: SdUserSummaryDTO | null
  contact: { id: string; name: string } | null
  visibility: SdMessageVisibilityDTO
  channel: SdMessageChannelDTO
  /** Texto puro (com emoji). */
  body: string
  attachments: SdTicketAttachmentDTO[]
  editedAt: string | null
  createdAt: string
  /** O usuário atual pode editar/excluir (autor, em até 15 minutos). */
  canEdit: boolean
  /** Fim da janela de edição do autor (`null` quando não é o autor). */
  editableUntil: string | null
}

/** Página em ordem cronológica (mais antigas primeiro). */
export interface SdTicketMessagePageDTO {
  items: SdTicketMessageDTO[]
  /** Id para `?before=` (mensagens mais antigas); `null` = início. */
  nextBefore: string | null
}
