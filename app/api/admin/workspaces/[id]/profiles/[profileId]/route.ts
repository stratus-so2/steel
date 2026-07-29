import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { UpdateProfileSchema } from '@/src/schemas/profile.schema'
import { AdminWorkspaceService } from '@/src/services/admin-workspace.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; profileId: string }> }

export const PATCH = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'PATCH /api/admin/workspaces/[id]/profiles/[profileId]',
  )
  if (!consent.ok) return handleError(consent.error)

  const [{ id, profileId }, body] = await Promise.all([
    ctx.params,
    request.json(),
  ])
  const parsed = UpdateProfileSchema.safeParse(body)

  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await AdminWorkspaceService.updateProfile(
    auth.value.user.id,
    id,
    profileId,
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
    'DELETE /api/admin/workspaces/[id]/profiles/[profileId]',
  )
  if (!consent.ok) return handleError(consent.error)

  const { id, profileId } = await ctx.params

  const result = await AdminWorkspaceService.removeProfile(
    auth.value.user.id,
    id,
    profileId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(null, 200)
})
