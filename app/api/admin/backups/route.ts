import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import {
  ListBackupsQuerySchema,
  TriggerBackupSchema,
} from '@/src/schemas/admin.schema'
import { AdminBackupService } from '@/src/services/admin-backup.service'
import { readJsonBody } from '@/utils/http-request'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

/** Backups (FULL e por workspace), mais recentes primeiro. */
export const GET = withAxiom(async (request: NextRequest) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const parsed = ListBackupsQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  )
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Filtros inválidos',
      parsed.error.issues,
    )
  }

  const result = await AdminBackupService.list(auth.value.user.id, parsed.data)
  if (!result.ok) return handleError(result.error)
  return successResponse(result.value)
})

/** Dispara um backup: `{ scope: 'FULL' }` ou `{ scope: 'WORKSPACE', workspaceId }` (202). */
export const POST = withAxiom(async (request: NextRequest) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'POST /api/admin/backups',
  )
  if (!consent.ok) return handleError(consent.error)

  const json = await readJsonBody(request, { allowEmpty: true })
  if (!json.ok) return handleError(json.error)
  const body = json.value
  const parsed = TriggerBackupSchema.safeParse(body)
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await AdminBackupService.trigger(
    auth.value.user.id,
    parsed.data,
  )
  if (!result.ok) return handleError(result.error)
  return successResponse(result.value, 202)
})
