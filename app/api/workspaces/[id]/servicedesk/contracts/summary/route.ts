import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { SdContractService } from '@/src/services/sd-contract.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string }> }

/** Contrato vigente de um cliente + consumo do período (tela do cliente). */
export const GET = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id } = await ctx.params
  const customerId = request.nextUrl.searchParams.get('customerId')
  if (!customerId) {
    return standardError('VALIDATION_ERROR', 'Informe o cliente (customerId)')
  }

  const result = await SdContractService.summaryForCustomer(
    auth.value.user.id,
    id,
    customerId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
