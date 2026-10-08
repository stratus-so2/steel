import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { UpdateWikiLabelSchema } from '@/src/schemas/wiki-label.schema'
import { WikiLabelService } from '@/src/services/wiki-label.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; labelId: string }> }

export const PATCH = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'PATCH /api/workspaces/[id]/wiki/labels/[labelId]',
  )
  if (!consent.ok) return handleError(consent.error)

  const [{ id, labelId }, body] = await Promise.all([
    ctx.params,
    request.json(),
  ])
  const parsed = UpdateWikiLabelSchema.safeParse(body)

  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await WikiLabelService.update(
    auth.value.user.id,
    id,
    labelId,
    parsed.data,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})

export const DELETE = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'DELETE /api/workspaces/[id]/wiki/labels/[labelId]',
  )
  if (!consent.ok) return handleError(consent.error)

  const { id, labelId } = await ctx.params

  const result = await WikiLabelService.delete(auth.value.user.id, id, labelId)
  if (!result.ok) return handleError(result.error)

  return successResponse(null, 200)
})
