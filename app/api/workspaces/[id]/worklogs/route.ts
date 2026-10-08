import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { WorklogListQuerySchema } from '@/src/schemas/worklog.schema'
import { WorklogService } from '@/src/services/worklog.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string }> }

/** Ajustes › Registros de trabalho: filtered time entries + totals. */
export const GET = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const query = WorklogListQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  )
  if (!query.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Parâmetros inválidos',
      query.error.issues,
    )
  }

  const { id } = await ctx.params
  const result = await WorklogService.list(auth.value.user.id, id, query.data)
  if (!result.ok) return handleError(result.error)
  return successResponse(result.value)
})
