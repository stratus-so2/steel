import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { RenderCrmEmailTemplateSchema } from '@/src/schemas/crm-email-builder.schema'
import { CrmEmailBuilderService } from '@/src/services/crm-email-builder.service'
import { readJsonBody } from '@/utils/http-request'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; templateId: string }> }

/** Renders a template for a CRM person or a sample contact (preview). */
export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const [{ id, templateId }, json] = await Promise.all([
    ctx.params,
    readJsonBody(request, { allowEmpty: true }),
  ])
  if (!json.ok) return handleError(json.error)
  const parsed = RenderCrmEmailTemplateSchema.safeParse(json.value ?? {})
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await CrmEmailBuilderService.render(
    auth.value.user.id,
    id,
    templateId,
    parsed.data,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
