import type { SdTicketAttachmentWithRelations } from '@/src/repositories/sd-ticket-attachment.repository'
import type { SdTicketMessageWithRelations } from '@/src/repositories/sd-ticket-message.repository'
import type {
  SdTicketAttachmentDTO,
  SdTicketMessageDTO,
} from '@/types/sd-ticket-message'

/** Janela para o autor editar/excluir a própria mensagem. */
export const SD_MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000

type AttachmentRow = Pick<
  SdTicketAttachmentWithRelations,
  | 'id'
  | 'workspaceId'
  | 'ticketId'
  | 'messageId'
  | 'kind'
  | 'fileName'
  | 'mimeType'
  | 'size'
  | 'uploadedBy'
  | 'createdAt'
>

export function sdAttachmentUrl(
  workspaceId: string,
  ticketId: string,
  attachmentId: string,
): string {
  return `/api/workspaces/${workspaceId}/servicedesk/tickets/${ticketId}/attachments/${attachmentId}`
}

export function toSdTicketAttachmentDTO(
  row: AttachmentRow,
): SdTicketAttachmentDTO {
  return {
    id: row.id,
    ticketId: row.ticketId,
    messageId: row.messageId,
    kind: row.kind,
    fileName: row.fileName,
    mimeType: row.mimeType,
    size: row.size,
    uploadedBy: row.uploadedBy,
    url: sdAttachmentUrl(row.workspaceId, row.ticketId, row.id),
    createdAt: row.createdAt.toISOString(),
  }
}

/** Fim da janela de edição, ou `null` quando `viewerId` não é o autor. */
export function sdMessageEditableUntil(
  row: Pick<SdTicketMessageWithRelations, 'authorUserId' | 'createdAt'>,
  viewerId: string,
): Date | null {
  if (!row.authorUserId || row.authorUserId !== viewerId) return null
  return new Date(row.createdAt.getTime() + SD_MESSAGE_EDIT_WINDOW_MS)
}

export function toSdTicketMessageDTO(
  row: SdTicketMessageWithRelations,
  viewer: { userId: string; now?: Date },
): SdTicketMessageDTO {
  const until = sdMessageEditableUntil(row, viewer.userId)
  const now = viewer.now ?? new Date()
  return {
    id: row.id,
    ticketId: row.ticketId,
    authorKind: row.authorKind,
    author: row.authorUser,
    contact: row.authorContact,
    visibility: row.visibility,
    channel: row.channel,
    body: row.body,
    attachments: row.attachments.map(toSdTicketAttachmentDTO),
    editedAt: row.editedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    canEdit: until !== null && until.getTime() > now.getTime(),
    editableUntil: until?.toISOString() ?? null,
  }
}
