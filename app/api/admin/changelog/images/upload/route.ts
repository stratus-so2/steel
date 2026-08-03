import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { badRequest } from '@/src/errors'
import { getAuthSession } from '@/src/lib/auth-session'
import { consume, uploadLimiter } from '@/src/lib/rate-limit'
import { assertPlatformAdmin } from '@/src/services/authz'
import { persistChangelogImage } from '@/src/services/media/changelog-media.service'
import { handleError, successResponse } from '@/utils/http-response'

const MAX_BYTES = 5 * 1024 * 1024 // 5MB, matches validateImage's own cap

export const POST = withAxiom(async (request: NextRequest) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(uploadLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const admin = await assertPlatformAdmin(auth.value.user.id)
  if (!admin.ok) return handleError(admin.error)

  const contentType = request.headers.get('content-type')
  if (!contentType) {
    return handleError(badRequest('Content-Type é obrigatório'))
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (contentLength > MAX_BYTES) {
    return handleError(badRequest('Arquivo muito grande. Máximo 5 MB'))
  }

  const stored = await persistChangelogImage({
    contentType,
    byteSize: contentLength,
    readBody: async () => Buffer.from(await request.arrayBuffer()),
  })
  if (!stored.ok) return handleError(stored.error)

  return successResponse(stored.value, 201)
})
