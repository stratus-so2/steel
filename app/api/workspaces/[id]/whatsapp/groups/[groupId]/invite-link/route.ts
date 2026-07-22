import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { WhatsAppGroupService } from '@/src/services/whatsapp-group.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = { params: Promise<{ id: string; groupId: string }> }

export const POST = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, groupId } = await ctx.params

  const result = await WhatsAppGroupService.getInviteLink(
    auth.value.user.id,
    id,
    groupId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
