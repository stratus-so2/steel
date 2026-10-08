import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { ListWikiMentionableMembersSchema } from '@/src/schemas/wiki-page.schema'
import { WikiPageService } from '@/src/services/wiki-page.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string }> }

export const GET = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { searchParams } = new URL(request.url)
  const parsed = ListWikiMentionableMembersSchema.safeParse({
    q: searchParams.get('q') ?? undefined,
  })
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Parâmetros inválidos',
      parsed.error.issues,
    )
  }

  const { id } = await ctx.params
  const result = await WikiPageService.listMentionableMembers(
    auth.value.user.id,
    id,
    parsed.data.q,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
