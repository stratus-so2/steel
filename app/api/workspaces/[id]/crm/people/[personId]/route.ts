import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { UpdateCrmPersonSchema } from '@/src/schemas/crm-person.schema'
import { CrmPersonService } from '@/src/services/crm-person.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; personId: string }> }

export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, personId } = await ctx.params

  const result = await CrmPersonService.getById(
    auth.value.user.id,
    id,
    personId,
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
    'PATCH /api/workspaces/[id]/crm/people/[personId]',
  )
  if (!consent.ok) return handleError(consent.error)

  const [{ id, personId }, body] = await Promise.all([
    ctx.params,
    request.json(),
  ])
  const parsed = UpdateCrmPersonSchema.safeParse(body)

  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await CrmPersonService.update(
    auth.value.user.id,
    id,
    personId,
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
    'DELETE /api/workspaces/[id]/crm/people/[personId]',
  )
  if (!consent.ok) return handleError(consent.error)

  const { id, personId } = await ctx.params

  const result = await CrmPersonService.remove(auth.value.user.id, id, personId)
  if (!result.ok) return handleError(result.error)

  return successResponse(null, 200)
})
