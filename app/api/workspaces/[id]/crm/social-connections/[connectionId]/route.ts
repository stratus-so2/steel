import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { CrmSocialConnectionService } from '@/src/services/crm-social.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = { params: Promise<{ id: string; connectionId: string }> }

export const DELETE = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'DELETE /api/workspaces/[id]/crm/social-connections/[connectionId]',
  )
  if (!consent.ok) return handleError(consent.error)

  const { id, connectionId } = await ctx.params

  const result = await CrmSocialConnectionService.remove(
    auth.value.user.id,
    id,
    connectionId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(null, 200)
})
