import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { ReorderCrmPipelineStagesSchema } from '@/src/schemas/crm-pipeline.schema'
import { CrmPipelineStageService } from '@/src/services/crm-pipeline.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; pipelineId: string }> }

export const PATCH = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'PATCH /api/workspaces/[id]/crm/pipelines/[pipelineId]/stages/reorder',
  )
  if (!consent.ok) return handleError(consent.error)

  const [{ id, pipelineId }, body] = await Promise.all([
    ctx.params,
    request.json(),
  ])
  const parsed = ReorderCrmPipelineStagesSchema.safeParse(body)

  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await CrmPipelineStageService.reorder(
    auth.value.user.id,
    id,
    pipelineId,
    parsed.data.orderedIds,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(null, 200)
})
