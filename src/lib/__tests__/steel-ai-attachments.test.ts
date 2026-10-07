import { describe, expect, it } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import {
  AI_ATTACHMENT_HISTORY_DOC_MAX_CHARS,
  AI_ATTACHMENT_MAX_DOCUMENT_BYTES,
  AI_ATTACHMENT_MAX_IMAGE_BYTES,
  AI_ATTACHMENT_ONLY_PROMPT,
  AI_ATTACHMENT_PROMPT_DOC_MAX_CHARS,
  AI_ATTACHMENT_PROMPT_TOTAL_MAX_CHARS,
  AI_ATTACHMENT_STORED_TEXT_MAX_CHARS,
  aiAttachmentDisplayName,
  aiAttachmentKey,
  baseMime,
  buildUserContent,
  classifyAiAttachment,
  documentBlock,
  historyAttachmentNote,
  normalizeExtractedText,
  resolveAiAttachmentType,
} from '@/src/lib/ai/attachments'

describe('Steel AI attachments', () => {
  it('should normalize the MIME type and fall back to the extension', () => {
    expect(baseMime('Text/Plain; charset=utf-8')).toBe('text/plain')
    expect(resolveAiAttachmentType('a.png', 'image/png')).toBe('image/png')
    expect(resolveAiAttachmentType('notas.md', '')).toBe('text/markdown')
    expect(
      resolveAiAttachmentType('dados.CSV', 'application/octet-stream'),
    ).toBe('text/csv')
    expect(resolveAiAttachmentType('x.exe', 'application/x-msdownload')).toBe(
      'application/x-msdownload',
    )
    expect(resolveAiAttachmentType('semextensao', '')).toBe('')
  })

  it('should classify images and documents within their limits', () => {
    expect(
      expectOk(
        classifyAiAttachment({
          filename: 'foto.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 10,
        }),
      ),
    ).toEqual({ kind: 'IMAGE', contentType: 'image/jpeg' })
    expect(
      expectOk(
        classifyAiAttachment({
          filename: 'a.pdf',
          contentType: 'application/pdf',
          sizeBytes: 10,
        }),
      ).kind,
    ).toBe('DOCUMENT')
  })

  it('should refuse unsupported, empty and oversized files', () => {
    expectErr(
      classifyAiAttachment({
        filename: 'a.zip',
        contentType: 'application/zip',
        sizeBytes: 10,
      }),
      'AI_ATTACHMENT_UNSUPPORTED',
    )
    expectErr(
      classifyAiAttachment({
        filename: 'a.txt',
        contentType: 'text/plain',
        sizeBytes: 0,
      }),
      'AI_ATTACHMENT_UNSUPPORTED',
    )
    const image = expectErr(
      classifyAiAttachment({
        filename: 'a.png',
        contentType: 'image/png',
        sizeBytes: AI_ATTACHMENT_MAX_IMAGE_BYTES + 1,
      }),
      'AI_ATTACHMENT_TOO_LARGE',
    )
    expect(image.message).toContain('5 MB para imagens')
    const doc = expectErr(
      classifyAiAttachment({
        filename: 'a.pdf',
        contentType: 'application/pdf',
        sizeBytes: AI_ATTACHMENT_MAX_DOCUMENT_BYTES + 1,
      }),
      'AI_ATTACHMENT_TOO_LARGE',
    )
    expect(doc.message).toContain('10 MB para documentos')
  })

  it('should build display names and storage keys', () => {
    expect(aiAttachmentDisplayName('C:\\docs\\relatório.pdf')).toBe(
      'relatório.pdf',
    )
    expect(aiAttachmentDisplayName('   ')).toBe('arquivo')
    expect(aiAttachmentKey('ws', 'c', 'id', 'relatório final.pdf')).toBe(
      'ws/c/id-relat_rio_final.pdf',
    )
    expect(aiAttachmentKey('ws', 'c', 'id', '')).toBe('ws/c/id-file')
  })

  it('should normalize and cap extracted text', () => {
    expect(normalizeExtractedText('a  \r\n\r\n\r\n\r\nb\t\n')).toBe('a\n\nb')
    expect(
      normalizeExtractedText(
        'x'.repeat(AI_ATTACHMENT_STORED_TEXT_MAX_CHARS + 5),
      ).length,
    ).toBe(AI_ATTACHMENT_STORED_TEXT_MAX_CHARS)
  })

  it('should truncate a document block with a note', () => {
    expect(documentBlock('a"b.txt', 'abc', 10)).toBe(
      '<anexo nome="a\'b.txt">\nabc\n</anexo>',
    )
    expect(documentBlock('a.txt', 'abcdef', 3)).toContain(
      'conteúdo truncado: 3 caracteres omitidos',
    )
  })

  it('should keep a plain string without attachments', () => {
    expect(buildUserContent('Oi', [])).toBe('Oi')
  })

  it('should inline documents and add image parts', () => {
    const parts = buildUserContent('', [
      {
        kind: 'IMAGE',
        filename: 'f.png',
        contentType: 'image/png',
        extractedText: null,
        data: Buffer.from('img'),
      },
      {
        kind: 'IMAGE',
        filename: 'sem-bytes.png',
        contentType: 'image/png',
        extractedText: null,
      },
      {
        kind: 'DOCUMENT',
        filename: 'n.txt',
        contentType: 'text/plain',
        extractedText: 'nota',
      },
    ])
    expect(Array.isArray(parts)).toBe(true)
    const [text, image, ...rest] = parts as {
      type: string
      text?: string
      url?: string
    }[]
    expect(text.text?.startsWith(AI_ATTACHMENT_ONLY_PROMPT)).toBe(true)
    expect(text.text).toContain('<anexo nome="n.txt">\nnota\n</anexo>')
    expect(image).toEqual({
      type: 'image',
      url: `data:image/png;base64,${Buffer.from('img').toString('base64')}`,
    })
    expect(rest).toEqual([])
  })

  it('should keep only text when there are no images', () => {
    const parts = buildUserContent('Resuma', [
      {
        kind: 'DOCUMENT',
        filename: 'vazio.txt',
        contentType: 'text/plain',
        extractedText: null,
      },
    ]) as { type: string; text: string }[]
    expect(parts).toHaveLength(1)
    expect(parts[0].text).toBe('Resuma\n\n<anexo nome="vazio.txt">\n\n</anexo>')
  })

  it('should respect the per-document and per-message budgets', () => {
    const big = 'x'.repeat(AI_ATTACHMENT_PROMPT_DOC_MAX_CHARS + 100)
    const docs = Array.from({ length: 4 }, (_, i) => ({
      kind: 'DOCUMENT' as const,
      filename: `d${i}.txt`,
      contentType: 'text/plain',
      extractedText: big,
    }))
    const [text] = buildUserContent('Leia', docs) as {
      type: string
      text: string
    }[]
    // 2 full docs (24k) + 12k of the third = the 60k budget; the 4th is omitted.
    expect(text.text.length).toBeLessThan(
      AI_ATTACHMENT_PROMPT_TOTAL_MAX_CHARS + 2_000,
    )
    expect(text.text).toContain(
      '<anexo nome="d3.txt">[omitido: limite de texto dos anexos desta mensagem atingido]</anexo>',
    )
  })

  it('should resend earlier attachments as a short note', () => {
    expect(historyAttachmentNote([])).toBe('')
    const note = historyAttachmentNote([
      { kind: 'IMAGE', filename: 'f.png', extractedText: null },
      {
        kind: 'DOCUMENT',
        filename: 'd.txt',
        extractedText: 'y'.repeat(AI_ATTACHMENT_HISTORY_DOC_MAX_CHARS + 10),
      },
      { kind: 'DOCUMENT', filename: 'e.txt', extractedText: null },
    ])
    expect(note).toContain('[imagem enviada antes; não reenviada]')
    expect(note).toContain('conteúdo truncado: 10 caracteres omitidos')
    expect(note).toContain('<anexo nome="e.txt">')
  })
})
