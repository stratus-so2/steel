import { createId } from '@paralleldrive/cuid2'
import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import {
  sdAttachmentInvalid,
  sdAttachmentNotFound,
  sdTicketForbidden,
  storageError,
} from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  SD_ATTACHMENT_MAX_BYTES,
  SD_TICKET_BUCKET,
  sdAttachmentKey,
  sdAttachmentKind,
  sdBaseMime,
} from '@/src/lib/servicedesk/ticket-files'
import {
  deleteObject,
  ensureBucket,
  getObject,
  putObject,
} from '@/src/lib/storage/s3'
import { toSdTicketAttachmentDTO } from '@/src/mappers/sd-ticket-message.mapper'
import {
  SdTicketAttachmentRepository,
  type SdTicketAttachmentWithRelations,
} from '@/src/repositories/sd-ticket-attachment.repository'
import type { SdTicketAttachmentDTO } from '@/types/sd-ticket-message'
import { SdTicketEngine } from './sd-ticket-engine'
import { recordSdTicketEvent } from './sd-ticket-event-recorder'
import {
  loadSdTicketTab,
  publishSdTicketTab,
  sdTabAuthorKind,
} from './sd-ticket-tab-support'

export interface SdAttachmentUpload {
  buffer: Buffer
  contentType: string
  fileName: string
}

export interface SdAttachmentFile {
  body: Buffer
  contentType: string
  fileName: string
}

/**
 * Solicitantes só veem anexos de mensagens públicas (não excluídas) e os
 * próprios ainda soltos; agentes veem todos.
 */
export function canSeeSdAttachment(
  viewer: { userId: string; isAgent: boolean },
  row: Pick<
    SdTicketAttachmentWithRelations,
    'messageId' | 'uploadedById' | 'message'
  >,
): boolean {
  if (viewer.isAgent) return true
  if (!row.messageId) return row.uploadedById === viewer.userId
  return row.message?.visibility === 'PUBLIC' && !row.message.deletedAt
}

function displayName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop()?.trim() ?? ''
  return (base || 'arquivo').slice(0, 255)
}

/**
 * Anexos do chamado (MinIO, bucket `servicedesk`). O envio é em duas
 * etapas: `upload` grava o arquivo solto e a mensagem o prende depois
 * (`attachmentIds`). O download passa sempre por aqui (confere o acesso).
 */
export const SdTicketAttachmentService = {
  async upload(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    file: SdAttachmentUpload,
  ): Promise<Result<SdTicketAttachmentDTO>> {
    const loaded = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'CREATE',
      { requireOpen: true },
    )
    if (!loaded.ok) return loaded
    const { ticket, ctx } = loaded.value

    const kind = sdAttachmentKind(file.contentType)
    if (!kind) return err(sdAttachmentInvalid('Tipo de arquivo não permitido'))
    if (file.buffer.byteLength === 0) {
      return err(sdAttachmentInvalid('Arquivo vazio'))
    }
    if (file.buffer.byteLength > SD_ATTACHMENT_MAX_BYTES) {
      return err(sdAttachmentInvalid('Arquivo muito grande. Máximo 25MB'))
    }

    const id = createId()
    const fileName = displayName(file.fileName)
    const storageKey = sdAttachmentKey(workspaceId, ticket.id, id, fileName)
    const mimeType = sdBaseMime(file.contentType)
    try {
      await ensureBucket(SD_TICKET_BUCKET)
      await putObject({
        bucket: SD_TICKET_BUCKET,
        key: storageKey,
        body: file.buffer,
        contentType: mimeType,
      })
    } catch (error) {
      logger.error('servicedesk.attachment.persist_failed', {
        workspaceId,
        ticketId: ticket.id,
        message: error instanceof Error ? error.message : String(error),
      })
      return err(storageError('Falha ao armazenar o arquivo'))
    }

    const created = await SdTicketAttachmentRepository.create({
      id,
      workspaceId,
      ticketId: ticket.id,
      uploadedById: actorId,
      kind,
      fileName,
      mimeType: mimeType,
      size: file.buffer.byteLength,
      storageKey,
    })
    if (!created.ok) return created

    await SdTicketEngine.touchActivity(ticket.id)
    await recordSdTicketEvent({
      workspaceId,
      ticketId: ticket.id,
      actorKind: sdTabAuthorKind(ctx),
      actorUserId: actorId,
      action: 'attachment.uploaded',
      meta: { attachmentId: id, kind, size: file.buffer.byteLength },
    })
    // Solto (ainda sem mensagem): só agentes precisam saber.
    await publishSdTicketTab(ticket, 'ticket.attachment', actorId, true)
    auditMutation({
      entity: 'sd_ticket_attachment',
      action: 'upload',
      actorId,
      targetId: id,
      meta: {
        workspaceId,
        ticketId: ticket.id,
        kind,
        size: file.buffer.length,
      },
    })
    return ok(toSdTicketAttachmentDTO(created.value))
  },

  async list(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
  ): Promise<Result<SdTicketAttachmentDTO[]>> {
    const loaded = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'VIEW',
    )
    if (!loaded.ok) return loaded
    const rows = await SdTicketAttachmentRepository.listForTicket({
      ticketId: loaded.value.ticket.id,
      includeInternal: loaded.value.ctx.isAgent,
      viewerId: actorId,
    })
    if (!rows.ok) return rows
    return ok(rows.value.map(toSdTicketAttachmentDTO))
  },

  async download(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    attachmentId: string,
  ): Promise<Result<SdAttachmentFile>> {
    const loaded = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'VIEW',
    )
    if (!loaded.ok) return loaded
    const row = await SdTicketAttachmentRepository.findById(
      attachmentId,
      loaded.value.ticket.id,
    )
    if (!row.ok) return row
    if (!canSeeSdAttachment(loaded.value.ctx, row.value)) {
      return err(sdAttachmentNotFound())
    }
    try {
      const body = await getObject({
        bucket: SD_TICKET_BUCKET,
        key: row.value.storageKey,
      })
      return ok({
        body,
        contentType: row.value.mimeType,
        fileName: row.value.fileName,
      })
    } catch {
      return err(sdAttachmentNotFound())
    }
  },

  /**
   * Remove um anexo: agentes, qualquer um; solicitantes, só os próprios
   * ainda soltos (tirados do rascunho).
   */
  async remove(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    attachmentId: string,
  ): Promise<Result<void>> {
    const loaded = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'EDIT',
      { requireOpen: true },
    )
    if (!loaded.ok) return loaded
    const { ctx, ticket } = loaded.value
    const row = await SdTicketAttachmentRepository.findById(
      attachmentId,
      ticket.id,
    )
    if (!row.ok) return row
    if (!canSeeSdAttachment(ctx, row.value)) return err(sdAttachmentNotFound())
    if (!ctx.isAgent && row.value.messageId) {
      return err(sdTicketForbidden('Só agentes removem anexos já enviados'))
    }

    const removed = await SdTicketAttachmentRepository.softDelete(
      attachmentId,
      new Date(),
    )
    if (!removed.ok) return removed
    try {
      await deleteObject({
        bucket: SD_TICKET_BUCKET,
        key: row.value.storageKey,
      })
    } catch (error) {
      logger.warn('servicedesk.attachment.delete_object_failed', {
        workspaceId,
        attachmentId,
        message: error instanceof Error ? error.message : String(error),
      })
    }

    const internal =
      !row.value.messageId || row.value.message?.visibility === 'INTERNAL'
    await recordSdTicketEvent({
      workspaceId,
      ticketId: ticket.id,
      actorKind: sdTabAuthorKind(ctx),
      actorUserId: actorId,
      action: 'attachment.removed',
      meta: { attachmentId, fileName: row.value.fileName },
    })
    await publishSdTicketTab(ticket, 'ticket.attachment', actorId, internal)
    auditMutation({
      entity: 'sd_ticket_attachment',
      action: 'delete',
      actorId,
      targetId: attachmentId,
      meta: { workspaceId, ticketId: ticket.id },
    })
    return ok(undefined)
  },
}
