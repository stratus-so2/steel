import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { SearchQuerySchema } from '@/src/schemas/search.schema'
import { SearchService } from '@/src/services/search.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string }> }

/** Global search (Ctrl+K) across the modules the user can access. */
export const GET = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id } = await ctx.params
  const { searchParams } = new URL(request.url)
  const parsed = SearchQuerySchema.safeParse({
    q: searchParams.get('q') ?? '',
    types: searchParams.get('types') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  })
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Parâmetros inválidos',
      parsed.error.issues,
    )
  }

  const result = await SearchService.search(auth.value.user.id, id, parsed.data)
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
