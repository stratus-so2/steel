export type ChangelogStatusDTO = 'DRAFT' | 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED'

export type ChangelogRecipientStatusDTO = 'PENDING' | 'SENT' | 'FAILED'

export interface ChangelogItemDTO {
  id: string
  title: string
  body: string
  imageUrl: string | null
  position: number
}

export interface ChangelogRecipientDTO {
  id: string
  email: string
  userId: string | null
  status: ChangelogRecipientStatusDTO
  errorMessage: string | null
  sentAt: string | null
}

export interface ChangelogSummaryDTO {
  id: string
  subject: string
  status: ChangelogStatusDTO
  createdById: string
  recipientCount: number
  sentCount: number
  failedCount: number
  createdAt: string
  updatedAt: string
}

export interface ChangelogDetailDTO extends ChangelogSummaryDTO {
  items: ChangelogItemDTO[]
  recipients: ChangelogRecipientDTO[]
}

/** Resultado da busca global de usuários para o seletor de destinatários. */
export interface ChangelogUserSearchResultDTO {
  id: string
  name: string
  email: string
  image: string | null
}
