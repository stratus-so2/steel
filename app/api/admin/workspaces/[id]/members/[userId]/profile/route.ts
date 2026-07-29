import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { AdminWorkspaceService } from '@/src/services/admin-workspace.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; userId: string }> }

const SetProfileSchema = z.object({ profileId: z.string().min(1).nullable() })

export const PATCH = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'PATCH /api/admin/workspaces/[id]/members/[userId]/profile',
  )
  if (!consent.ok) return handleError(consent.error)

  const [{ id, userId }, body] = await Promise.all([ctx.params, request.json()])
  const parsed = SetProfileSchema.safeParse(body)

  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await AdminWorkspaceService.setMemberProfile(
    auth.value.user.id,
    id,
    userId,
    parsed.data.profileId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse({ updated: true })
})
