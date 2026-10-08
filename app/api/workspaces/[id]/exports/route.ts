import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { CreateWorkspaceExportSchema } from '@/src/schemas/workspace-export.schema'
import { WorkspaceExportService } from '@/src/services/workspace-export.service'
import { readJsonBody } from '@/utils/http-request'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string }> }

/** Ajustes › Exportações: history + what can be requested today. */
export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id } = await ctx.params
  const result = await WorkspaceExportService.overview(auth.value.user.id, id)
  if (!result.ok) return handleError(result.error)
  return successResponse(result.value)
})

/** Requests an export (complete data or Axiom logs) — once a day per kind. */
export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const json = await readJsonBody(request)
  if (!json.ok) return handleError(json.error)
  const parsed = CreateWorkspaceExportSchema.safeParse(json.value)
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const { id } = await ctx.params
  const result = await WorkspaceExportService.request(
    auth.value.user.id,
    id,
    parsed.data,
  )
  if (!result.ok) return handleError(result.error)
  return successResponse(result.value, 202)
})
