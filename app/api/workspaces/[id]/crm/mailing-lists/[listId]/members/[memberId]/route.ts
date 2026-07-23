import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { CrmMailingListService } from '@/src/services/crm-mailing-list.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = {
  params: Promise<{ id: string; listId: string; memberId: string }>
}

export const DELETE = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'DELETE /api/workspaces/[id]/crm/mailing-lists/[listId]/members/[memberId]',
  )
  if (!consent.ok) return handleError(consent.error)

  const { id, listId, memberId } = await ctx.params

  const result = await CrmMailingListService.removeMember(
    auth.value.user.id,
    id,
    listId,
    memberId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(null, 200)
})
