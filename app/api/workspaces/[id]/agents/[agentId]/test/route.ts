import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { SteelAgentService } from '@/src/services/steel-agent.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = { params: Promise<{ id: string; agentId: string }> }

/**
 * "Testar agente": queues a test run (202 — it runs in the worker). Reads
 * run for real; every write is simulated, nothing is changed or sent.
 */
export const POST = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'POST /api/workspaces/[id]/agents/[agentId]/test',
  )
  if (!consent.ok) return handleError(consent.error)

  const { id, agentId } = await ctx.params
  const result = await SteelAgentService.testRun(
    auth.value.user.id,
    id,
    agentId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value, 202)
})
