import { describe, expect, it } from 'vitest'
import { createFakeWhatsAppAiKnowledgeDocument } from '@/src/__tests__/factories/whatsapp-ai-knowledge-document.factory'
import { toWhatsAppAiKnowledgeDocumentDTO } from '../whatsapp-ai-knowledge-document.mapper'

describe('toWhatsAppAiKnowledgeDocumentDTO()', () => {
  it('should map all fields correctly', () => {
    const document = createFakeWhatsAppAiKnowledgeDocument({
      id: 'doc-1',
      workspaceId: 'ws-1',
      filename: 'manual.pdf',
      contentType: 'application/pdf',
      sizeBytes: 2048,
      status: 'READY',
      errorMessage: null,
      createdById: 'u-1',
    })

    const dto = toWhatsAppAiKnowledgeDocumentDTO(document)

    expect(dto).toEqual({
      id: 'doc-1',
      workspaceId: 'ws-1',
      filename: 'manual.pdf',
      contentType: 'application/pdf',
      sizeBytes: 2048,
      status: 'READY',
      errorMessage: null,
      createdById: 'u-1',
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    })
  })

  it('should not leak extractedText into the DTO', () => {
    const document = createFakeWhatsAppAiKnowledgeDocument({
      extractedText: 'conteúdo sensível interno',
    })

    const dto = toWhatsAppAiKnowledgeDocumentDTO(document)

    expect(dto).not.toHaveProperty('extractedText')
  })

  it('should preserve the errorMessage when status is FAILED', () => {
    const document = createFakeWhatsAppAiKnowledgeDocument({
      status: 'FAILED',
      errorMessage: 'Formato não suportado',
    })

    const dto = toWhatsAppAiKnowledgeDocumentDTO(document)

    expect(dto.status).toBe('FAILED')
    expect(dto.errorMessage).toBe('Formato não suportado')
  })
})
