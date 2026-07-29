import mammoth from 'mammoth'
// Importa o módulo interno em vez de 'pdf-parse': o index.js do pacote roda
// um bloco de "auto-teste" no import quando `module.parent` é undefined
// (comum em runtimes ESM/test runners), tentando ler um fixture que não
// existe fora do próprio repo da lib e derrubando o import com ENOENT.
import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import { whatsappAiKnowledgeDocumentUnsupportedType } from '@/src/errors'
import { validationError } from '@/src/errors/app-error'
import { err, ok, type Result } from '@/src/lib/result'

export const MAX_KNOWLEDGE_DOCUMENT_BYTES = 10 * 1024 * 1024 // 10MB

const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const SUPPORTED_EXTENSION_BY_TYPE: Record<string, string> = {
  'application/pdf': 'pdf',
  [DOCX_CONTENT_TYPE]: 'docx',
  'text/plain': 'txt',
  'text/csv': 'csv',
}

export function classifyKnowledgeDocument(
  contentType: string,
  sizeBytes: number,
): Result<{ ext: string }> {
  if (sizeBytes > MAX_KNOWLEDGE_DOCUMENT_BYTES) {
    return err(validationError('Arquivo muito grande. Máximo 10 MB'))
  }
  const ext = SUPPORTED_EXTENSION_BY_TYPE[contentType]
  if (!ext) {
    return err(whatsappAiKnowledgeDocumentUnsupportedType())
  }
  return ok({ ext })
}

/**
 * Extração de texto para injeção direta no prompt (sem OCR — imagem não é
 * suportada, decisão registrada no plano da feature).
 */
export async function extractKnowledgeDocumentText(
  contentType: string,
  body: Buffer,
): Promise<Result<string, string>> {
  try {
    if (contentType === 'application/pdf') {
      const parsed = await pdfParse(body)
      return ok(parsed.text.trim())
    }
    if (contentType === DOCX_CONTENT_TYPE) {
      const parsed = await mammoth.extractRawText({ buffer: body })
      return ok(parsed.value.trim())
    }
    return ok(body.toString('utf-8').trim())
  } catch (error) {
    return err(
      error instanceof Error ? error.message : 'Falha ao extrair texto',
    )
  }
}
