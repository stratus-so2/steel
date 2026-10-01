import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { sdApprovalNotFound } from '@/src/errors'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import {
  RespondSdApprovalSchema,
  SdApprovalTokenSchema,
} from '@/src/schemas/sd-ticket-approval.schema'
import { SdTicketApprovalService } from '@/src/services/sd-ticket-approval.service'
import { readJsonBody } from '@/utils/http-request'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ token: string }> }

function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  )
}

/** Resumo público do pedido de aprovação (sem sessão — o token é o acesso). */
export const GET = withAxiom(async (request: NextRequest, ctx: Params) => {
  const limit = await consume(apiLimiter, `ip:${clientIp(request)}`)
  if (!limit.ok) return handleError(limit.error)

  const { token } = await ctx.params
  if (!SdApprovalTokenSchema.safeParse(token).success) {
    return handleError(sdApprovalNotFound())
  }
  const result = await SdTicketApprovalService.publicPreview(token)
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})

/** Aprova ou reprova pelo link do e-mail (`{ decision, comment }`). */
export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const limit = await consume(apiLimiter, `ip:${clientIp(request)}`)
  if (!limit.ok) return handleError(limit.error)

  const [{ token }, json] = await Promise.all([
    ctx.params,
    readJsonBody(request),
  ])
  if (!SdApprovalTokenSchema.safeParse(token).success) {
    return handleError(sdApprovalNotFound())
  }
  if (!json.ok) return handleError(json.error)
  const parsed = RespondSdApprovalSchema.safeParse(json.value)
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await SdTicketApprovalService.respond(token, parsed.data)
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
