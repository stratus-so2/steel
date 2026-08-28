import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { badRequest } from '@/src/errors'
import { getAuthSession } from '@/src/lib/auth-session'
import { consume, uploadLimiter } from '@/src/lib/rate-limit'
import { assertMember } from '@/src/services/authz'
import { persistCrmLandingPageVideo } from '@/src/services/media/crm-landing-page-media.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = { params: Promise<{ id: string }> }

const MAX_BYTES = 25 * 1024 * 1024 // 25MB, matches persistCrmLandingPageVideo's own cap

export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(uploadLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id } = await ctx.params

  const membership = await assertMember(auth.value.user.id, id)
  if (!membership.ok) return handleError(membership.error)

  const contentType = request.headers.get('content-type')
  if (!contentType) {
    return handleError(badRequest('Content-Type é obrigatório'))
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (contentLength > MAX_BYTES) {
    return handleError(badRequest('Arquivo muito grande. Máximo 25 MB'))
  }

  const stored = await persistCrmLandingPageVideo({
    contentType,
    byteSize: contentLength,
    readBody: async () => Buffer.from(await request.arrayBuffer()),
  })
  if (!stored.ok) return handleError(stored.error)

  return successResponse(stored.value, 201)
})
