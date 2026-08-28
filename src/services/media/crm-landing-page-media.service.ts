import { randomUUID } from 'node:crypto'
import { ok, type Result } from '@/src/lib/result'
import { persistObject, validateImage } from './_media'

const BUCKET = 'crm-landing-page-images'

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
