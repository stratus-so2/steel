import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { AnalyticsQuerySchema } from '@/src/schemas/admin-analytics.schema'
import { AdminAnalyticsService } from '@/src/services/admin-analytics.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

/**
 * Painel Analytics (logs de requisição no Axiom + filas BullMQ): uma aba por
 * chamada (`view`), com intervalo e filtros. Cada painel traz o próprio
 * erro; sem `AXIOM_QUERY_TOKEN` devolve `unconfigured: true`.
 */
export const GET = withAxiom(async (request: NextRequest) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const parsed = AnalyticsQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  )
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Filtros inválidos',
      parsed.error.issues,
    )
  }

  const result = await AdminAnalyticsService.get(
    auth.value.user.id,
    parsed.data,
  )
  if (!result.ok) return handleError(result.error)
  return successResponse(result.value)
})
