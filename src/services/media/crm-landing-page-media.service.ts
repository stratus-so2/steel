import { randomUUID } from 'node:crypto'
import { validationError } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { persistObject, validateImage } from './_media'

const BUCKET = 'crm-landing-page-images'
const VIDEO_BUCKET = 'crm-landing-page-videos'
const MAX_VIDEO_BYTES = 25 * 1024 * 1024 // 25MB — banner curto em loop, não conteúdo longo
const ALLOWED_VIDEO_TYPES: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
}

export async function persistCrmLandingPageImage(input: {
  contentType: string
  byteSize: number
  readBody: () => Promise<Buffer>
}): Promise<Result<{ url: string }>> {
  const validation = validateImage(input.contentType, input.byteSize)
  if (!validation.ok) return validation
  const ext = validation.value

  const body = await input.readBody()
  const key = `${randomUUID()}.${ext}`

  const stored = await persistObject({
    bucket: BUCKET,
    key,
    body,
    contentType: input.contentType,
    component: 'CrmLandingPageMediaService',
    event: 'crm_landing_page_media.persist_failed',
  })
  if (!stored.ok) return stored

  return ok({ url: stored.value })
}

function validateVideo(contentType: string, byteSize: number): Result<string> {
  const ext = ALLOWED_VIDEO_TYPES[contentType]
  if (!ext)
    return err(validationError('Formato não suportado. Use MP4 ou WebM'))
  if (byteSize > MAX_VIDEO_BYTES)
    return err(validationError('Arquivo muito grande. Máximo 25 MB'))

  return ok(ext)
}

export async function persistCrmLandingPageVideo(input: {
  contentType: string
  byteSize: number
  readBody: () => Promise<Buffer>
}): Promise<Result<{ url: string }>> {
  const validation = validateVideo(input.contentType, input.byteSize)
  if (!validation.ok) return validation
  const ext = validation.value

  const body = await input.readBody()
  const key = `${randomUUID()}.${ext}`

  const stored = await persistObject({
    bucket: VIDEO_BUCKET,
    key,
    body,
    contentType: input.contentType,
    component: 'CrmLandingPageMediaService',
    event: 'crm_landing_page_media.persist_video_failed',
  })
  if (!stored.ok) return stored

  return ok({ url: stored.value })
}
