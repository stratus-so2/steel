import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { CrmWorkflowService } from '@/src/services/crm-workflow.service'
import { readJsonBody } from '@/utils/http-request'
import { handleError, successResponse } from '@/utils/http-response'

type Params = { params: Promise<{ webhookToken: string }> }

export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'

  const limit = await consume(apiLimiter, `ip:${ip}`)
  if (!limit.ok) return handleError(limit.error)

  const { webhookToken } = await ctx.params
  const json = await readJsonBody(request, { allowEmpty: true })
  if (!json.ok) return handleError(json.error)
  const body = json.value
  const payload =
    body && typeof body === 'object' ? (body as Record<string, unknown>) : {}

  const result = await CrmWorkflowService.triggerWebhook(webhookToken, payload)
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value, 201)
})
