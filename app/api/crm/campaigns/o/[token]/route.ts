import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { CrmCampaignTrackingService } from '@/src/services/crm-campaign-tracking.service'

type Params = { params: Promise<{ token: string }> }

// 1×1 transparent GIF.
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
)

/**
 * Public open pixel of CRM campaign e-mails. Always answers the image —
 * tracking is best-effort and never breaks the e-mail rendering.
 */
export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const { token } = await ctx.params
  await CrmCampaignTrackingService.recordOpen(token, new Date())
  return new Response(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, max-age=0',
    },
  })
})
