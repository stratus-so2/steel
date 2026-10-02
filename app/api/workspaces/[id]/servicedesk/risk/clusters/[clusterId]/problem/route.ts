import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { OpenSdClusterProblemSchema } from '@/src/schemas/sd-risk.schema'
import { SdRiskService } from '@/src/services/sd-risk.service'
import { readJsonBody } from '@/utils/http-request'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; clusterId: string }> }

const ROUTE =
  '/api/workspaces/[id]/servicedesk/risk/clusters/[clusterId]/problem' as const

/**
 * Abre o problema a partir do agrupamento e vincula os incidentes como
 * filhos. É sempre **ação humana**: o worker só sugere (ADR 0016).
 */
export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(auth.value.user.id, `POST ${ROUTE}`)
  if (!consent.ok) return handleError(consent.error)

  const [{ id, clusterId }, json] = await Promise.all([
    ctx.params,
    readJsonBody(request, { allowEmpty: true }),
  ])
  if (!json.ok) return handleError(json.error)
  const parsed = OpenSdClusterProblemSchema.safeParse(json.value)
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await SdRiskService.openProblem(
    auth.value.user.id,
    id,
    clusterId,
    parsed.data,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value, 201)
})
