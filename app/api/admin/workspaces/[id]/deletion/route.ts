import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { ConfirmedWorkspaceActionSchema } from '@/src/schemas/admin.schema'
import { AdminWorkspaceLifecycleService } from '@/src/services/admin-workspace-lifecycle.service'
import { readJsonBody } from '@/utils/http-request'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string }> }
/**
 * Pede a exclusão definitiva (202): o worker faz backup do workspace e só
 * então apaga dados e arquivos. Acompanhe por `GET /api/admin/operations/[id]`.
 */
export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'POST /api/admin/workspaces/[id]/deletion',
  )
  if (!consent.ok) return handleError(consent.error)

  const [{ id }, json] = await Promise.all([
    ctx.params,
    readJsonBody(request, { allowEmpty: true }),
  ])
  if (!json.ok) return handleError(json.error)
  const body = json.value
  const parsed = ConfirmedWorkspaceActionSchema.safeParse(body)
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await AdminWorkspaceLifecycleService.requestDeletion(
    auth.value.user.id,
    id,
    parsed.data,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value, 202)
})
