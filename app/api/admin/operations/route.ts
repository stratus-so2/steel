import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { AdminWorkspaceLifecycleService } from '@/src/services/admin-workspace-lifecycle.service'
import { handleError, successResponse } from '@/utils/http-response'

/** Exclusões/restaurações recentes (`?workspaceId=` filtra por workspace). */
export const GET = withAxiom(async (request: NextRequest) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const workspaceId =
    request.nextUrl.searchParams.get('workspaceId') ?? undefined
  const result = await AdminWorkspaceLifecycleService.listOperations(
    auth.value.user.id,
    { workspaceId },
  )
  if (!result.ok) return handleError(result.error)
  return successResponse(result.value)
})
