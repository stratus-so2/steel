import type { SdAttachmentKind } from '@prisma/client'

/**
 * Arquivos dos chamados no MinIO (bucket privado `servicedesk`, o mesmo da
 * mídia da KB — ver `WORKSPACE_BUCKETS`): anexos em
 * `<ws>/tickets/<ticketId>/<cuid>-<nome>` e assinaturas em
 * `<ws>/tickets/<ticketId>/signatures/<cuid>.png`. Sempre servidos por rota
 * autenticada que confere o acesso ao chamado.
 */
export const SD_TICKET_BUCKET = 'servicedesk'

/** Limite por anexo. */
export const SD_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024

/** Tipos aceitos → tipo de anexo (decide o player/preview na UI). */
export const SD_ATTACHMENT_MIME_KINDS: Readonly<
  Record<string, SdAttachmentKind>
> = {
  'image/png': 'IMAGE',
  'image/jpeg': 'IMAGE',
  'image/gif': 'IMAGE',
  'image/webp': 'IMAGE',
  'image/heic': 'IMAGE',
  'video/mp4': 'VIDEO',
  'video/webm': 'VIDEO',
  'video/quicktime': 'VIDEO',
  'audio/mpeg': 'AUDIO',
  'audio/mp4': 'AUDIO',
  'audio/x-m4a': 'AUDIO',
  'audio/aac': 'AUDIO',
  'audio/wav': 'AUDIO',
  'audio/x-wav': 'AUDIO',
  'audio/ogg': 'AUDIO',
  'audio/webm': 'AUDIO',
  'application/pdf': 'DOCUMENT',
  'text/plain': 'DOCUMENT',
  'text/csv': 'DOCUMENT',
  'application/msword': 'DOCUMENT',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'DOCUMENT',
  'application/vnd.ms-excel': 'DOCUMENT',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    'DOCUMENT',
  'application/vnd.ms-powerpoint': 'DOCUMENT',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'DOCUMENT',
  'application/vnd.oasis.opendocument.text': 'DOCUMENT',
  'application/vnd.oasis.opendocument.spreadsheet': 'DOCUMENT',
  'application/zip': 'OTHER',
  'application/x-zip-compressed': 'OTHER',
}

/** MIME sem parâmetros, em minúsculas (`Text/Plain; charset=x` → `text/plain`). */
export function sdBaseMime(mimeType: string): string {
  return mimeType.replace(/;.*$/, '').trim().toLowerCase()
}

/** Tipo do anexo pelo MIME, ou `null` se não permitido. */
export function sdAttachmentKind(mimeType: string): SdAttachmentKind | null {
  return SD_ATTACHMENT_MIME_KINDS[sdBaseMime(mimeType)] ?? null
}

/**
 * Nome seguro para a chave do objeto: sem diretórios, só `[A-Za-z0-9._-]`,
 * até 100 caracteres (o nome original fica na linha do banco).
 */
export function sdSafeFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? ''
  const cleaned = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+/, '')
    .slice(-100)
  return cleaned || 'arquivo'
}

export function sdTicketFilePrefix(workspaceId: string, ticketId: string) {
  return `${workspaceId}/tickets/${ticketId}/`
}

export function sdAttachmentKey(
  workspaceId: string,
  ticketId: string,
  attachmentId: string,
  fileName: string,
): string {
  return `${sdTicketFilePrefix(workspaceId, ticketId)}${attachmentId}-${sdSafeFileName(fileName)}`
}

export function sdSignatureKey(
  workspaceId: string,
  ticketId: string,
  signatureId: string,
): string {
  return `${sdTicketFilePrefix(workspaceId, ticketId)}signatures/${signatureId}.png`
}
