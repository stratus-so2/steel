import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { AdminWorkspaceLifecycleService } from '@/src/services/admin-workspace-lifecycle.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = { params: Promise<{ id: string }> }

/** Trilha de ações do admin global sobre o workspace (mais recentes). */
export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id } = await ctx.params
  const result = await AdminWorkspaceLifecycleService.listAudit(
    auth.value.user.id,
    id,
  )
  if (!result.ok) return handleError(result.error)
  return successResponse(result.value)
})
