import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { SdContractService } from '@/src/services/sd-contract.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = { params: Promise<{ id: string; contractId: string }> }

/** Histórico de períodos do contrato (consumo, excedente e valor). */
export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, contractId } = await ctx.params
  const result = await SdContractService.listPeriods(
    auth.value.user.id,
    id,
    contractId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
