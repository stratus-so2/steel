import 'server-only'
import { randomUUID } from 'node:crypto'
import { storageError } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { persistObject } from '@/src/services/media/_media'

const BUCKET = 'whatsapp-media'

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/aac': 'aac',
  'audio/amr': 'amr',
  'application/pdf': 'pdf',
}

function extensionFor(contentType: string): string {
  return EXTENSION_BY_CONTENT_TYPE[contentType] ?? 'bin'
}

export async function downloadRemoteMediaToStorage(input: {
  workspaceId: string
  url: string
  headers?: Record<string, string>
}): Promise<Result<{ url: string; contentType: string }>> {
  let response: Response
  try {
    response = await fetch(input.url, { headers: input.headers })
  } catch {
    return err(storageError('Falha ao baixar mídia do provedor'))
  }
  if (!response.ok) {
    return err(
      storageError(`Falha ao baixar mídia do provedor (${response.status})`),
    )
  }

  const contentType =
    response.headers.get('content-type') ?? 'application/octet-stream'
  const body = Buffer.from(await response.arrayBuffer())
  const key = `${input.workspaceId}/${randomUUID()}.${extensionFor(contentType)}`

  const stored = await persistObject({
    bucket: BUCKET,
    key,
    body,
    contentType,
    component: 'WhatsAppMedia',
    event: 'whatsapp_media.persist_failed',
  })
  if (!stored.ok) return stored

  return ok({ url: stored.value, contentType })
}

export async function persistOutboundMedia(input: {
  workspaceId: string
  body: Buffer
  contentType: string
}): Promise<Result<{ url: string }>> {
  const key = `${input.workspaceId}/${randomUUID()}.${extensionFor(input.contentType)}`

  const stored = await persistObject({
    bucket: BUCKET,
    key,
    body: input.body,
    contentType: input.contentType,
    component: 'WhatsAppMedia',
    event: 'whatsapp_media.persist_failed',
  })
  if (!stored.ok) return stored

  return ok({ url: stored.value })
}
