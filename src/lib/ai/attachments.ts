import type { AiAttachmentKind } from '@prisma/client'
import {
  type AppError,
  aiAttachmentUnsupported,
  appError,
} from '@/src/errors/app-error'
import { err, ok, type Result } from '@/src/lib/result'
import type { AiContentPart } from './types'

/**
 * Files and photos sent to Steel AI: what is accepted, the limits and how an
 * attachment becomes model input. IMAGE goes as a vision part (base64 data
 * URL — the MinIO bucket is private, so the provider could not fetch a
 * presigned URL); DOCUMENT goes as its extracted text, bounded.
 */

/** Private bucket; keys are `<workspaceId>/<conversationId>/<id>-<name>`. */
export const AI_ATTACHMENT_BUCKET = 'steel-ai-attachments'

export const AI_ATTACHMENT_MAX_PER_MESSAGE = 5
/** Both providers cap a single image at 5 MB. */
export const AI_ATTACHMENT_MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const AI_ATTACHMENT_MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
/** Uploaded but not sent yet, per conversation (abandoned drafts). */
export const AI_ATTACHMENT_MAX_UNSENT = 20

/** Extracted text kept on the row (the prompt uses less, see below). */
export const AI_ATTACHMENT_STORED_TEXT_MAX_CHARS = 200_000
/** Per document in the turn it is sent (~6k tokens). */
export const AI_ATTACHMENT_PROMPT_DOC_MAX_CHARS = 24_000
/** All documents of one message together (~15k tokens). */
export const AI_ATTACHMENT_PROMPT_TOTAL_MAX_CHARS = 60_000
/** Per document when an earlier message is resent as history. */
export const AI_ATTACHMENT_HISTORY_DOC_MAX_CHARS = 2_000

export const AI_ATTACHMENT_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const

const DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export const AI_ATTACHMENT_DOCUMENT_TYPES = [
  'application/pdf',
  DOCX,
  'text/plain',
  'text/csv',
  'text/markdown',
] as const

/** `accept` of the file input: MIME types plus extensions browsers miss. */
export const AI_ATTACHMENT_ACCEPT = [
  ...AI_ATTACHMENT_IMAGE_TYPES,
  ...AI_ATTACHMENT_DOCUMENT_TYPES,
  '.md',
  '.csv',
  '.txt',
  '.docx',
]

const TYPE_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
  docx: DOCX,
  txt: 'text/plain',
  csv: 'text/csv',
  md: 'text/markdown',
  markdown: 'text/markdown',
}

const IMAGE_TYPES = new Set<string>(AI_ATTACHMENT_IMAGE_TYPES)
const DOCUMENT_TYPES = new Set<string>(AI_ATTACHMENT_DOCUMENT_TYPES)

/** `text/plain; charset=utf-8` → `text/plain`. */
export function baseMime(contentType: string): string {
  return contentType.split(';')[0].trim().toLowerCase()
}

/**
 * The declared type, or — when the browser sends none or a generic one
 * (common for `.md` and `.csv`) — the type of the file extension.
 */
export function resolveAiAttachmentType(
  filename: string,
  contentType: string,
): string {
  const declared = baseMime(contentType)
  if (IMAGE_TYPES.has(declared) || DOCUMENT_TYPES.has(declared)) {
    return declared
  }
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return TYPE_BY_EXTENSION[ext] ?? declared
}

export interface ClassifiedAiAttachment {
  kind: AiAttachmentKind
  contentType: string
}

/** Kind + normalized type, or AI_ATTACHMENT_UNSUPPORTED / _TOO_LARGE. */
export function classifyAiAttachment(input: {
  filename: string
  contentType: string
  sizeBytes: number
}): Result<ClassifiedAiAttachment, AppError> {
  const contentType = resolveAiAttachmentType(input.filename, input.contentType)
  const kind: AiAttachmentKind | null = IMAGE_TYPES.has(contentType)
    ? 'IMAGE'
    : DOCUMENT_TYPES.has(contentType)
      ? 'DOCUMENT'
      : null
  if (!kind) return err(aiAttachmentUnsupported())
  if (input.sizeBytes <= 0) {
    return err(appError('AI_ATTACHMENT_UNSUPPORTED', 'O arquivo está vazio'))
  }
  const max =
    kind === 'IMAGE'
      ? AI_ATTACHMENT_MAX_IMAGE_BYTES
      : AI_ATTACHMENT_MAX_DOCUMENT_BYTES
  if (input.sizeBytes > max) {
    return err(
      appError(
        'AI_ATTACHMENT_TOO_LARGE',
        `Arquivo grande demais para o Steel AI. Máximo de ${max / 1024 / 1024} MB para ${
          kind === 'IMAGE' ? 'imagens' : 'documentos'
        }.`,
      ),
    )
  }
  return ok({ kind, contentType })
}

/** Display name without path, at most 255 chars. */
export function aiAttachmentDisplayName(filename: string): string {
  const base = filename.replace(/^.*[\\/]/, '').trim()
  return (base || 'arquivo').slice(0, 255)
}

export function aiAttachmentKey(
  workspaceId: string,
  conversationId: string,
  id: string,
  filename: string,
): string {
  const safe = filename.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80) || 'file'
  return `${workspaceId}/${conversationId}/${id}-${safe}`
}

/** Collapses runs of blank lines/spaces and caps the stored text. */
export function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, AI_ATTACHMENT_STORED_TEXT_MAX_CHARS)
}

function clip(text: string, max: number): string {
  return text.length > max
    ? `${text.slice(0, max)}\n[… conteúdo truncado: ${text.length - max} caracteres omitidos]`
    : text
}

/** A document as the model reads it. */
export function documentBlock(
  filename: string,
  text: string,
  maxChars: number,
): string {
  return `<anexo nome="${filename.replace(/"/g, "'")}">\n${clip(text, maxChars)}\n</anexo>`
}

/** What the model needs of an attachment to build the user message. */
export interface AiAttachmentInput {
  kind: AiAttachmentKind
  filename: string
  contentType: string
  extractedText: string | null
  /** IMAGE bytes (only for the turn being sent). */
  data?: Buffer
}

export const AI_ATTACHMENT_ONLY_PROMPT =
  'Analise o(s) anexo(s) desta mensagem.'

/**
 * User message of the current turn: text (with each document inlined,
 * within the per-document and per-message budgets) plus one vision part per
 * image. Without attachments it stays a plain string.
 */
export function buildUserContent(
  content: string,
  attachments: AiAttachmentInput[],
): string | AiContentPart[] {
  if (attachments.length === 0) return content
  const text = content.trim() || AI_ATTACHMENT_ONLY_PROMPT

  let budget = AI_ATTACHMENT_PROMPT_TOTAL_MAX_CHARS
  const blocks: string[] = []
  for (const doc of attachments.filter((a) => a.kind === 'DOCUMENT')) {
    const body = doc.extractedText ?? ''
    const max = Math.max(0, Math.min(AI_ATTACHMENT_PROMPT_DOC_MAX_CHARS, budget))
    blocks.push(
      max > 0
        ? documentBlock(doc.filename, body, max)
        : `<anexo nome="${doc.filename}">[omitido: limite de texto dos anexos desta mensagem atingido]</anexo>`,
    )
    budget -= Math.min(body.length, max)
  }

  const parts: AiContentPart[] = [
    {
      type: 'text',
      text: blocks.length > 0 ? `${text}\n\n${blocks.join('\n\n')}` : text,
    },
  ]
  for (const image of attachments.filter((a) => a.kind === 'IMAGE')) {
    if (!image.data) continue
    parts.push({
      type: 'image',
      url: `data:${image.contentType};base64,${image.data.toString('base64')}`,
    })
  }
  return parts
}

/**
 * Earlier message resent as history: images are not resent (only named) and
 * documents go as a short excerpt, so the history budget holds.
 */
export function historyAttachmentNote(
  attachments: Pick<AiAttachmentInput, 'kind' | 'filename' | 'extractedText'>[],
): string {
  if (attachments.length === 0) return ''
  const lines = attachments.map((a) =>
    a.kind === 'IMAGE'
      ? `<anexo nome="${a.filename}">[imagem enviada antes; não reenviada]</anexo>`
      : documentBlock(
          a.filename,
          a.extractedText ?? '',
          AI_ATTACHMENT_HISTORY_DOC_MAX_CHARS,
        ),
  )
  return lines.join('\n')
}
