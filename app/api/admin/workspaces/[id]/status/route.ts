import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { SetWorkspaceStatusSchema } from '@/src/schemas/admin.schema'
import { AdminWorkspaceLifecycleService } from '@/src/services/admin-workspace-lifecycle.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string }> }
/** Suspende ou reativa um workspace (admin global, motivo obrigatório). */
export const PATCH = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'PATCH /api/admin/workspaces/[id]/status',
  )
  if (!consent.ok) return handleError(consent.error)

  const [{ id }, body] = await Promise.all([
    ctx.params,
    request.json().catch(() => ({})),
  ])
  const parsed = SetWorkspaceStatusSchema.safeParse(body)
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result =
    parsed.data.action === 'suspend'
      ? await AdminWorkspaceLifecycleService.suspend(
          auth.value.user.id,
          id,
          parsed.data.reason,
        )
      : await AdminWorkspaceLifecycleService.reactivate(
          auth.value.user.id,
          id,
          parsed.data.reason,
        )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
