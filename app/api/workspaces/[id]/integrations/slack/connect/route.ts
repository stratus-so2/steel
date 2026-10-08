import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { WorkspaceIntegrationService } from '@/src/services/workspace-integration.service'
import { handleError } from '@/utils/http-response'

type Params = { params: Promise<{ id: string }> }

/**
 * Start of the Slack OAuth: redirects (`302`) to the authorization screen.
 * Opened by the browser — not a JSON call. The workspace travels in the
 * signed `state` because the callback path is fixed.
 */
export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id } = await ctx.params
  const result = await WorkspaceIntegrationService.beginSlackConnect(
    auth.value.user.id,
    id,
  )
  if (!result.ok) return handleError(result.error)

  return Response.redirect(result.value.authorizeUrl, 302)
})
