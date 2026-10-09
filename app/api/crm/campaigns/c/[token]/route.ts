import { type NextRequest, NextResponse } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { CrmCampaignTrackingService } from '@/src/services/crm-campaign-tracking.service'
import { handleError } from '@/utils/http-response'

type Params = { params: Promise<{ token: string }> }

/**
 * Public click redirect of CRM campaign links (no session — the signed token
 * is the key; listed in the proxy PUBLIC_ROUTES). Marks the click and sends
 * the contact to the destination with the UTM parameters.
 */
export const GET = withAxiom(async (request: NextRequest, ctx: Params) => {
  const limit = await consume(
    apiLimiter,
    `ip:${request.headers.get('x-forwarded-for') ?? 'unknown'}`,
  )
  if (!limit.ok) return handleError(limit.error)

  const { token } = await ctx.params
  const result = await CrmCampaignTrackingService.resolveClick(
    token,
    new Date(),
  )
  if (!result.ok) return handleError(result.error)

  return NextResponse.redirect(result.value, 302)
})
