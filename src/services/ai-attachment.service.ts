import { createId } from '@paralleldrive/cuid2'
import type { AiAttachment } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { logFields } from '@/lib/axiom/log-fields'
import { logger } from '@/lib/axiom/logger'
import { storageError } from '@/src/errors'
import {
  aiAttachmentNotFound,
  appError,
  validationError,
} from '@/src/errors/app-error'
import {
  AI_ATTACHMENT_BUCKET,
  AI_ATTACHMENT_MAX_UNSENT,
  type AiAttachmentInput,
  aiAttachmentDisplayName,
  aiAttachmentKey,
  classifyAiAttachment,
  historyAttachmentNote,
  normalizeExtractedText,
} from '@/src/lib/ai/attachments'
import { err, ok, type Result } from '@/src/lib/result'
import {
  deleteObject,
  ensureBucket,
  getObject,
  putObject,
} from '@/src/lib/storage/s3'
import { extractKnowledgeDocumentText } from '@/src/lib/whatsapp/knowledge-document'
import { toAiAttachmentDTO } from '@/src/mappers/ai-attachment.mapper'
import { AiAttachmentRepository } from '@/src/repositories/ai-attachment.repository'
import { AiConversationRepository } from '@/src/repositories/ai-conversation.repository'
import type { AiAttachmentDTO } from '@/types/steel-ai'
import { assertSteelAiEnabled } from './ai-conversation.service'
import { assertMember } from './authz'

export interface AiAttachmentUpload {
  buffer: Buffer
  contentType: string
  fileName: string
}

export interface AiAttachmentFile {
  body: Buffer
  contentType: string
  fileName: string
}

/** An attachment ready to go into the user message of a turn. */
export interface AiAttachmentForSend extends AiAttachmentInput {
  id: string
}

const UNREADABLE =
  'Não foi possível ler o texto deste arquivo. Envie um PDF com texto selecionável, DOCX, TXT, CSV ou Markdown.'

/** Member + master switch + own conversation (someone else's = 404). */
async function loadConversation(
  actorId: string,
  workspaceId: string,
  conversationId: string,
): Promise<Result<true>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership
  const enabled = await assertSteelAiEnabled(workspaceId)
  if (!enabled.ok) return enabled
  const conversation = await AiConversationRepository.findById(
    conversationId,
    workspaceId,
    actorId,
  )
  if (!conversation.ok) return conversation
  return ok(true)
}

async function extractText(
  contentType: string,
  body: Buffer,
): Promise<Result<string>> {
  const extracted = await extractKnowledgeDocumentText(contentType, body)
  const text = extracted.ok ? normalizeExtractedText(extracted.value) : ''
  if (!text) return err(appError('AI_ATTACHMENT_UNSUPPORTED', UNREADABLE))
  return ok(text)
}

/**
 * Files and photos sent to Steel AI (private MinIO bucket
 * `steel-ai-attachments`). Two steps, like the ticket attachments: `upload`
 * stores the file loose, the message send binds it (`attachmentIds`).
 * Documents have their text extracted at upload, so a bad file fails early.
 */
export const AiAttachmentService = {
  async upload(
    actorId: string,
    workspaceId: string,
    conversationId: string,
    file: AiAttachmentUpload,
  ): Promise<Result<AiAttachmentDTO>> {
    const loaded = await loadConversation(actorId, workspaceId, conversationId)
    if (!loaded.ok) return loaded

    const filename = aiAttachmentDisplayName(file.fileName)
    const classified = classifyAiAttachment({
      filename,
      contentType: file.contentType,
      sizeBytes: file.buffer.byteLength,
    })
    if (!classified.ok) return classified
    const { kind, contentType } = classified.value

    const unsent = await AiAttachmentRepository.countUnsent(conversationId)
    if (!unsent.ok) return unsent
    if (unsent.value >= AI_ATTACHMENT_MAX_UNSENT) {
      return err(
        validationError(
          'Há anexos demais aguardando envio nesta conversa. Envie ou remova alguns antes de anexar outros.',
        ),
      )
    }

    let extractedText: string | null = null
    if (kind === 'DOCUMENT') {
      const text = await extractText(contentType, file.buffer)
      if (!text.ok) return text
      extractedText = text.value
    }

    const id = createId()
    const storageKey = aiAttachmentKey(
      workspaceId,
      conversationId,
      id,
      filename,
    )
    try {
      await ensureBucket(AI_ATTACHMENT_BUCKET)
      await putObject({
        bucket: AI_ATTACHMENT_BUCKET,
        key: storageKey,
        body: file.buffer,
        contentType,
      })
    } catch (cause) {
      logger.error(
        'steel_ai.attachment_store_failed',
        logFields({
          component: 'AiAttachmentService',
          workspaceId,
          conversationId,
          message: cause instanceof Error ? cause.message : String(cause),
        }),
      )
      return err(storageError('Falha ao armazenar o arquivo'))
    }

    const created = await AiAttachmentRepository.create({
      id,
      workspaceId,
      conversationId,
      uploadedById: actorId,
      kind,
      filename,
      contentType,
      sizeBytes: file.buffer.byteLength,
      storageKey,
      extractedText,
    })
    if (!created.ok) return created

    auditMutation({
      entity: 'ai_attachment',
      action: 'upload',
      actorId,
      targetId: id,
      meta: {
        workspaceId,
        conversationId,
        kind,
        contentType,
        size: file.buffer.byteLength,
      },
    })
    return ok(toAiAttachmentDTO(created.value, workspaceId))
  },

  /** Serves the file to its owner (thumbnails, download). */
  async download(
    actorId: string,
    workspaceId: string,
    conversationId: string,
    attachmentId: string,
  ): Promise<Result<AiAttachmentFile>> {
    const loaded = await loadConversation(actorId, workspaceId, conversationId)
    if (!loaded.ok) return loaded

    const row = await AiAttachmentRepository.findById(
      attachmentId,
      conversationId,
    )
    if (!row.ok) return row

    try {
      const body = await getObject({
        bucket: AI_ATTACHMENT_BUCKET,
        key: row.value.storageKey,
      })
      return ok({
        body,
        contentType: row.value.contentType,
        fileName: row.value.filename,
      })
    } catch {
      return err(aiAttachmentNotFound())
    }
  },

  /** Removes an attachment that was not sent yet (composer "x"). */
  async remove(
    actorId: string,
    workspaceId: string,
    conversationId: string,
    attachmentId: string,
  ): Promise<Result<void>> {
    const loaded = await loadConversation(actorId, workspaceId, conversationId)
    if (!loaded.ok) return loaded

    const row = await AiAttachmentRepository.findById(
      attachmentId,
      conversationId,
    )
    if (!row.ok) return row
    if (row.value.messageId) {
      return err(validationError('Um anexo já enviado não pode ser removido'))
    }

    const removed = await AiAttachmentRepository.deleteUnsent(attachmentId)
    if (!removed.ok) return removed
    if (!removed.value) return err(aiAttachmentNotFound())

    try {
      await deleteObject({
        bucket: AI_ATTACHMENT_BUCKET,
        key: row.value.storageKey,
      })
    } catch (cause) {
      // The row is gone; an orphan object is only storage, never shown.
      logger.warn(
        'steel_ai.attachment_object_delete_failed',
        logFields({
          component: 'AiAttachmentService',
          workspaceId,
          conversationId,
          message: cause instanceof Error ? cause.message : String(cause),
        }),
      )
    }

    auditMutation({
      entity: 'ai_attachment',
      action: 'delete',
      actorId,
      targetId: attachmentId,
      meta: { workspaceId, conversationId },
    })
    return ok(undefined)
  },

  /**
   * The caller's unsent attachments for a message, in the given order, with
   * image bytes loaded. Any id that is unknown, someone else's, from another
   * conversation or already sent fails the whole send (404).
   */
  async loadForSend(
    actorId: string,
    conversationId: string,
    ids: string[],
  ): Promise<Result<AiAttachmentForSend[]>> {
    const unique = [...new Set(ids)]
    if (unique.length === 0) return ok([])

    const rows = await AiAttachmentRepository.listUnsent(
      unique,
      conversationId,
      actorId,
    )
    if (!rows.ok) return rows
    if (rows.value.length !== unique.length) return err(aiAttachmentNotFound())

    const byId = new Map(rows.value.map((row) => [row.id, row]))
    const result: AiAttachmentForSend[] = []
    for (const id of unique) {
      const row = byId.get(id) as AiAttachment
      let data: Buffer | undefined
      if (row.kind === 'IMAGE') {
        try {
          data = await getObject({
            bucket: AI_ATTACHMENT_BUCKET,
            key: row.storageKey,
          })
        } catch {
          return err(storageError('Falha ao ler o anexo'))
        }
      }
      result.push({
        id: row.id,
        kind: row.kind,
        filename: row.filename,
        contentType: row.contentType,
        extractedText: row.extractedText,
        ...(data && { data }),
      })
    }
    return ok(result)
  },

  /** Notes resent with earlier USER messages, keyed by message id. */
  async historyNotes(messageIds: string[]): Promise<Map<string, string>> {
    const notes = new Map<string, string>()
    const rows = await AiAttachmentRepository.listByMessageIds(messageIds)
    if (!rows.ok) return notes
    const byMessage = new Map<string, AiAttachment[]>()
    for (const row of rows.value) {
      const list = byMessage.get(row.messageId as string) ?? []
      list.push(row)
      byMessage.set(row.messageId as string, list)
    }
    for (const [messageId, list] of byMessage) {
      notes.set(messageId, historyAttachmentNote(list))
    }
    return notes
  },
}
