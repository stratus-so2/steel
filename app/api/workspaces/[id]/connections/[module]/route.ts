import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import {
  ModuleKindSchema,
  SaveWorkspaceConnectionSchema,
} from '@/src/schemas/workspace-connection.schema'
import { WorkspaceConnectionService } from '@/src/services/workspace-connection.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; module: string }> }

export const PUT = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'PUT /api/workspaces/[id]/connections/[module]',
  )
  if (!consent.ok) return handleError(consent.error)

  const [{ id, module }, body] = await Promise.all([
    ctx.params,
    request.json().catch(() => ({})),
  ])

  const moduleParsed = ModuleKindSchema.safeParse(module)
  if (!moduleParsed.success) {
    return standardError('VALIDATION_ERROR', 'Módulo inválido')
  }

  const bodyParsed = SaveWorkspaceConnectionSchema.safeParse(body)
  if (!bodyParsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      bodyParsed.error.issues,
    )
  }

  const result = await WorkspaceConnectionService.save(
    auth.value.user.id,
    id,
    moduleParsed.data,
    bodyParsed.data,
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
    'DELETE /api/workspaces/[id]/connections/[module]',
  )
  if (!consent.ok) return handleError(consent.error)

  const { id, module } = await ctx.params

  const moduleParsed = ModuleKindSchema.safeParse(module)
  if (!moduleParsed.success) {
    return standardError('VALIDATION_ERROR', 'Módulo inválido')
  }

  const result = await WorkspaceConnectionService.remove(
    auth.value.user.id,
    id,
    moduleParsed.data,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(null, 200)
})
