import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { RescheduleCrmScheduledPostSchema } from '@/src/schemas/crm-social.schema'
import { CrmScheduledPostService } from '@/src/services/crm-social.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; postId: string }> }

export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'POST /api/workspaces/[id]/crm/scheduled-posts/[postId]/reschedule',
  )
  if (!consent.ok) return handleError(consent.error)

  const [{ id, postId }, body] = await Promise.all([
    ctx.params,
    request.json().catch(() => ({})),
  ])
  const parsed = RescheduleCrmScheduledPostSchema.safeParse(body)

  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await CrmScheduledPostService.reschedule(
    auth.value.user.id,
    id,
    postId,
    parsed.data.scheduledFor,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
