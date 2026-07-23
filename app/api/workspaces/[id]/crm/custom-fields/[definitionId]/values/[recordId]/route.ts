import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { SetCrmCustomFieldValueSchema } from '@/src/schemas/crm-custom-field.schema'
import { CrmCustomFieldValueService } from '@/src/services/crm-custom-field.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = {
  params: Promise<{ id: string; definitionId: string; recordId: string }>
}

export const PATCH = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'PATCH /api/workspaces/[id]/crm/custom-fields/[definitionId]/values/[recordId]',
  )
  if (!consent.ok) return handleError(consent.error)

  const [{ id, definitionId, recordId }, body] = await Promise.all([
    ctx.params,
    request.json(),
  ])
  const parsed = SetCrmCustomFieldValueSchema.safeParse(body)

  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await CrmCustomFieldValueService.setValue(
    auth.value.user.id,
    id,
    definitionId,
    recordId,
    parsed.data.value,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
