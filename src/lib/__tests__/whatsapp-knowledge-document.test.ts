import { describe, expect, it } from 'vitest'
import {
  classifyKnowledgeDocument,
  extractKnowledgeDocumentText,
} from '../whatsapp/knowledge-document'

describe('classifyKnowledgeDocument()', () => {
  it('should accept a PDF', () => {
    const result = classifyKnowledgeDocument('application/pdf', 1024)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.ext).toBe('pdf')
  })

  it('should accept a DOCX', () => {
    const result = classifyKnowledgeDocument(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      1024,
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.ext).toBe('docx')
  })

  it('should accept plain text and csv', () => {
    expect(classifyKnowledgeDocument('text/plain', 1024).ok).toBe(true)
    expect(classifyKnowledgeDocument('text/csv', 1024).ok).toBe(true)
  })

  it('should reject an unsupported type', () => {
    const result = classifyKnowledgeDocument('image/png', 1024)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe(
        'WHATSAPP_AI_KNOWLEDGE_DOCUMENT_UNSUPPORTED_TYPE',
      )
    }
  })

  it('should reject a file larger than 10MB', () => {
    const result = classifyKnowledgeDocument(
      'application/pdf',
      11 * 1024 * 1024,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('extractKnowledgeDocumentText()', () => {
  it('should extract plain text as-is', async () => {
    const result = await extractKnowledgeDocumentText(
      'text/plain',
      Buffer.from('Horário de funcionamento: 9h às 18h'),
    )
    expect(result.ok).toBe(true)
    if (result.ok)
      expect(result.value).toBe('Horário de funcionamento: 9h às 18h')
  })

  it('should extract csv as raw text', async () => {
    const result = await extractKnowledgeDocumentText(
      'text/csv',
      Buffer.from('nome,valor\nplano A,100'),
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toContain('plano A,100')
  })

  it('should trim surrounding whitespace', async () => {
    const result = await extractKnowledgeDocumentText(
      'text/plain',
      Buffer.from('  com espaço em volta  \n'),
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('com espaço em volta')
  })

  it('should return an error result for a corrupt pdf buffer', async () => {
    const result = await extractKnowledgeDocumentText(
      'application/pdf',
      Buffer.from('not a real pdf'),
    )
    expect(result.ok).toBe(false)
  })
})
