import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { AdminOverviewService } from '@/src/services/admin-overview.service'
import { handleError, successResponse } from '@/utils/http-response'

/** Visão geral da plataforma (mesmos dados da página /admin). */
export const GET = withAxiom(async (_request: NextRequest) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const result = await AdminOverviewService.get(auth.value.user.id)
  if (!result.ok) return handleError(result.error)
  return successResponse(result.value)
})
