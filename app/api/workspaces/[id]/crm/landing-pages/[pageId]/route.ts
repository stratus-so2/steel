import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { UpdateCrmLandingPageSchema } from '@/src/schemas/crm-landing-page.schema'
import { CrmLandingPageService } from '@/src/services/crm-landing-page.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; pageId: string }> }

export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, pageId } = await ctx.params

  const result = await CrmLandingPageService.getById(
    auth.value.user.id,
    id,
    pageId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})

export const PATCH = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'PATCH /api/workspaces/[id]/crm/landing-pages/[pageId]',
  )
  if (!consent.ok) return handleError(consent.error)

  const [{ id, pageId }, body] = await Promise.all([ctx.params, request.json()])
  const parsed = UpdateCrmLandingPageSchema.safeParse(body)

  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await CrmLandingPageService.update(
    auth.value.user.id,
    id,
    pageId,
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
    'DELETE /api/workspaces/[id]/crm/landing-pages/[pageId]',
  )
  if (!consent.ok) return handleError(consent.error)

  const { id, pageId } = await ctx.params

  const result = await CrmLandingPageService.remove(
    auth.value.user.id,
    id,
    pageId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(null, 200)
})
