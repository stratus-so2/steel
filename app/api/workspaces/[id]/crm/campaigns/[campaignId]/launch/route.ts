import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { LaunchCrmCampaignSchema } from '@/src/schemas/crm-campaign.schema'
import { CrmCampaignService } from '@/src/services/crm-campaign.service'
import { readJsonBody } from '@/utils/http-request'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; campaignId: string }> }

/** Launch (send now or schedule) — the sender confirms the LGPD basis. */
export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'POST /api/workspaces/[id]/crm/campaigns/[campaignId]/launch',
  )
  if (!consent.ok) return handleError(consent.error)

  const { id, campaignId } = await ctx.params
  const json = await readJsonBody(request)
  if (!json.ok) return handleError(json.error)
  const parsed = LaunchCrmCampaignSchema.safeParse(json.value)
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Confirme a base legal para o envio',
      parsed.error.issues,
    )
  }

  const result = await CrmCampaignService.launch(
    auth.value.user.id,
    id,
    campaignId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
