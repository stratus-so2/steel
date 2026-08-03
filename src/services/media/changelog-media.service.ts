import { randomUUID } from 'node:crypto'
import { ok, type Result } from '@/src/lib/result'
import { persistObject, validateImage } from './_media'

const BUCKET = 'changelog-images'

export async function persistChangelogImage(input: {
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
    component: 'ChangelogMediaService',
    event: 'changelog_media.persist_failed',
  })
  if (!stored.ok) return stored

  return ok({ url: stored.value })
}
