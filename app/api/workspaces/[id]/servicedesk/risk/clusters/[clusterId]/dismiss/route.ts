import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { SdRiskService } from '@/src/services/sd-risk.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = { params: Promise<{ id: string; clusterId: string }> }

const ROUTE =
  '/api/workspaces/[id]/servicedesk/risk/clusters/[clusterId]/dismiss' as const

/**
 * Descarta a sugestão: o grupo sai da lista e só volta a sugerir se os
 * incidentes se repetirem de novo depois do descarte.
 */
export const POST = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(auth.value.user.id, `POST ${ROUTE}`)
  if (!consent.ok) return handleError(consent.error)

  const { id, clusterId } = await ctx.params
  const result = await SdRiskService.dismissCluster(
    auth.value.user.id,
    id,
    clusterId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
