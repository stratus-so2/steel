import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { AcceptCrmProposalSchema } from '@/src/schemas/crm-proposal.schema'
import { CrmProposalService } from '@/src/services/crm-proposal.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ shareToken: string }> }

/** Aceite público da proposta (sem sessão — o token é o acesso). */
export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'

  const limit = await consume(apiLimiter, `ip:${ip}`)
  if (!limit.ok) return handleError(limit.error)

  const { shareToken } = await ctx.params
  const body = await request.json().catch(() => ({}))
  const parsed = AcceptCrmProposalSchema.safeParse(body)

  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await CrmProposalService.accept(shareToken, ip, parsed.data)
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
