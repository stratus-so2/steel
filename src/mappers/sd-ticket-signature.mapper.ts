import type { SdTicketSignatureWithRelations } from '@/src/repositories/sd-ticket-signature.repository'
import type { SdTicketSignatureDTO } from '@/types/sd-ticket-signature'

export function sdSignatureImageUrl(
  workspaceId: string,
  ticketId: string,
  signatureId: string,
): string {
  return `/api/workspaces/${workspaceId}/servicedesk/tickets/${ticketId}/signatures/${signatureId}/image`
}

export function toSdTicketSignatureDTO(
  row: SdTicketSignatureWithRelations,
): SdTicketSignatureDTO {
  return {
    id: row.id,
    ticketId: row.ticketId,
    purpose: row.purpose,
    signerName: row.signerName,
    signerDocument: row.signerDocument,
    signerEmail: row.signerEmail,
    signedBy: row.signedBy,
    imageUrl: sdSignatureImageUrl(row.workspaceId, row.ticketId, row.id),
    imageSha256: row.imageSha256,
    ticketSha256: row.ticketSha256,
    signedAt: row.signedAt.toISOString(),
  }
}
