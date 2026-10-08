import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { SetWikiPageLabelsSchema } from '@/src/schemas/wiki-label.schema'
import { WikiPageService } from '@/src/services/wiki-page.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; wikiPageId: string }> }

export const PUT = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'PUT /api/workspaces/[id]/wiki/[wikiPageId]/labels',
  )
  if (!consent.ok) return handleError(consent.error)

  const [{ id, wikiPageId }, body] = await Promise.all([
    ctx.params,
    request.json(),
  ])
  const parsed = SetWikiPageLabelsSchema.safeParse(body)

  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await WikiPageService.setLabels(
    auth.value.user.id,
    id,
    wikiPageId,
    parsed.data,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
