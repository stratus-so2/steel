import { createId } from '@paralleldrive/cuid2'
import type { CrmAiAttachmentKind } from '@prisma/client'
import { validationError } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  ensureBucket,
  getPresignedDownloadUrl,
  putObject,
} from '@/src/lib/storage/s3'

const BUCKET = 'crm-ai-attachments'
const MAX_BYTES = 10 * 1024 * 1024 // 10MB
const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const DOCUMENT_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'text/plain': 'txt',
}

export function classifyAttachment(
  contentType: string,
  byteSize: number,
): Result<{ kind: CrmAiAttachmentKind; ext: string }> {
  if (byteSize > MAX_BYTES) {
    return err(validationError('Arquivo muito grande. Máximo 10 MB'))
  }
  if (IMAGE_TYPES[contentType]) {
    return ok({ kind: 'IMAGE', ext: IMAGE_TYPES[contentType] })
  }
  if (DOCUMENT_TYPES[contentType]) {
    return ok({ kind: 'DOCUMENT', ext: DOCUMENT_TYPES[contentType] })
  }
  return err(
    validationError('Formato não suportado. Use JPEG, PNG, WebP, PDF ou TXT'),
  )
}

export async function storeAttachment(
  conversationId: string,
  body: Buffer,
  contentType: string,
  ext: string,
): Promise<string> {
  const key = `${conversationId}/${createId()}.${ext}`
  await ensureBucket(BUCKET)
  await putObject({ bucket: BUCKET, key, body, contentType })
  return key
}

export async function getAttachmentDownloadUrl(
  storageKey: string,
): Promise<string> {
  return getPresignedDownloadUrl({
    bucket: BUCKET,
    key: storageKey,
    expiresInSeconds: 15 * 60,
  })
}
