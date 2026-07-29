export type WhatsAppAiKnowledgeDocumentStatusDTO =
  | 'PROCESSING'
  | 'READY'
  | 'FAILED'

export interface WhatsAppAiKnowledgeDocumentDTO {
  id: string
  workspaceId: string
  filename: string
  contentType: string
  sizeBytes: number
  status: WhatsAppAiKnowledgeDocumentStatusDTO
  errorMessage: string | null
  createdById: string
  createdAt: string
  updatedAt: string
}
