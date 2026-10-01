import type { SdUserSummaryDTO } from './sd-ticket'

export interface SdTicketSignatureDTO {
  id: string
  ticketId: string
  purpose: string
  signerName: string
  signerDocument: string | null
  signerEmail: string | null
  signedBy: SdUserSummaryDTO | null
  /** Rota autenticada que serve o PNG. */
  imageUrl: string
  imageSha256: string
  ticketSha256: string
  signedAt: string
}

export interface SdTicketSignatureVerificationDTO {
  signatureId: string
  /** O SHA-256 recalculado do PNG armazenado bate com o gravado. */
  imageIntact: boolean
  storedImageSha256: string
  /** `null` quando o arquivo não foi encontrado no armazenamento. */
  computedImageSha256: string | null
  /** O snapshot atual do chamado ainda bate com o assinado. */
  ticketUnchanged: boolean
  signedTicketSha256: string
  currentTicketSha256: string
  verifiedAt: string
}
