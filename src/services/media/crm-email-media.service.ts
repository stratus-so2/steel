import { ok, type Result } from '@/src/lib/result'
import { persistObject, validateImage, workspaceMediaKey } from './_media'

/** Public bucket: images must load in the recipients' mail clients. */
export const CRM_EMAIL_IMAGE_BUCKET = 'crm-email-images'

/** Image of a visual-builder e-mail (JPEG/PNG/WebP, up to 5 MB). */
export async function persistCrmEmailImage(input: {
  workspaceId: string
  contentType: string
  byteSize: number
  readBody: () => Promise<Buffer>
}): Promise<Result<{ url: string }>> {
  const validation = validateImage(input.contentType, input.byteSize)
  if (!validation.ok) return validation

  const body = await input.readBody()
  const stored = await persistObject({
    bucket: CRM_EMAIL_IMAGE_BUCKET,
    key: workspaceMediaKey(input.workspaceId, validation.value),
    body,
    contentType: input.contentType,
    component: 'CrmEmailMediaService',
    event: 'crm_email_media.persist_failed',
  })
  if (!stored.ok) return stored

  return ok({ url: stored.value })
}
