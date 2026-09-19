import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { AcceptInvitationSchema } from '@/src/schemas/invitation.schema'
import { InvitationService } from '@/src/services/invitation.service'
import { readJsonBody } from '@/utils/http-request'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

export const POST = withAxiom(async (request: NextRequest) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const json = await readJsonBody(request)
  if (!json.ok) return handleError(json.error)

  const parsed = AcceptInvitationSchema.safeParse(json.value)
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await InvitationService.accept(
    auth.value.user.id,
    auth.value.user.email,
    parsed.data.token,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
