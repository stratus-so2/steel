import { createId } from '@paralleldrive/cuid2'
import type {
  WhatsAppAiKnowledgeDocument,
  WhatsAppAiKnowledgeDocumentStatus,
} from '@prisma/client'
import { prisma } from '@/src/lib/prisma'

export function createFakeWhatsAppAiKnowledgeDocument(
  overrides?: Partial<WhatsAppAiKnowledgeDocument>,
): WhatsAppAiKnowledgeDocument {
  const now = new Date()
  return {
    id: createId(),
    workspaceId: createId(),
    filename: 'manual-atendimento.pdf',
    contentType: 'application/pdf',
    sizeBytes: 1024,
    storageKey: `${createId()}.pdf`,
    status: 'READY' as WhatsAppAiKnowledgeDocumentStatus,
    extractedText: 'Horário de funcionamento: 9h às 18h',
    errorMessage: null,
    createdById: createId(),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedWhatsAppAiKnowledgeDocument(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<
    Pick<
      WhatsAppAiKnowledgeDocument,
      | 'filename'
      | 'contentType'
      | 'sizeBytes'
      | 'storageKey'
      | 'status'
      | 'extractedText'
      | 'errorMessage'
    >
  >,
) {
  return prisma.whatsAppAiKnowledgeDocument.create({
    data: {
      workspaceId,
      createdById,
      filename: 'manual-atendimento.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024,
      storageKey: `${createId()}.pdf`,
      status: 'READY',
      extractedText: 'Horário de funcionamento: 9h às 18h',
      ...overrides,
    },
  })
}
