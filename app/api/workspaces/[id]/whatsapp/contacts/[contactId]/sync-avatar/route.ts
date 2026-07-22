import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { WhatsAppContactService } from '@/src/services/whatsapp-contact.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = { params: Promise<{ id: string; contactId: string }> }

export const POST = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, contactId } = await ctx.params

  const result = await WhatsAppContactService.syncAvatar(
    auth.value.user.id,
    id,
    contactId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
