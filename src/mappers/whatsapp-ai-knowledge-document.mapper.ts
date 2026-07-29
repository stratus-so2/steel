import type { WhatsAppAiKnowledgeDocument } from '@prisma/client'
import type { WhatsAppAiKnowledgeDocumentDTO } from '@/types/whatsapp-ai-knowledge-document'

export function toWhatsAppAiKnowledgeDocumentDTO(
  document: WhatsAppAiKnowledgeDocument,
): WhatsAppAiKnowledgeDocumentDTO {
  return {
    id: document.id,
    workspaceId: document.workspaceId,
    filename: document.filename,
    contentType: document.contentType,
    sizeBytes: document.sizeBytes,
    status: document.status,
    errorMessage: document.errorMessage,
    createdById: document.createdById,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  }
}
