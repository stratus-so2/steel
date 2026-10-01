import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { SdPortalAccessService } from '@/src/services/sd-portal-access.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = { params: Promise<{ id: string; accessId: string }> }

/**
 * Revoga um link de acesso ao portal: o link deixa de valer e a sessão
 * aberta por ele cai na hora. Auditado (`sd_portal_access` / `revoke`).
 */
export const DELETE = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'DELETE /api/workspaces/[id]/servicedesk/portal-access/[accessId]',
  )
  if (!consent.ok) return handleError(consent.error)

  const { id, accessId } = await ctx.params
  const result = await SdPortalAccessService.revoke(
    auth.value.user.id,
    id,
    accessId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
