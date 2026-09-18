import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { ReleaseDraftRequestSchema } from '@/src/schemas/release-notes.schema'
import { ReleaseNotesService } from '@/src/services/release-notes.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

/** Rascunho do e-mail de novidades (não grava nada — o admin revisa antes). */
export const POST = withAxiom(async (request: NextRequest) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const body = await request.json().catch(() => ({}))
  const parsed = ReleaseDraftRequestSchema.safeParse(body)
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await ReleaseNotesService.draft(
    auth.value.user.id,
    parsed.data,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
