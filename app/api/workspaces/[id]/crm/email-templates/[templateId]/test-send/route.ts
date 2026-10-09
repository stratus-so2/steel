import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { consume, emailLimiter } from '@/src/lib/rate-limit'
import { RenderCrmEmailTemplateSchema } from '@/src/schemas/crm-email-builder.schema'
import { CrmEmailBuilderService } from '@/src/services/crm-email-builder.service'
import { readJsonBody } from '@/utils/http-request'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; templateId: string }> }

/** "Enviar teste": sends the rendered template to the caller's e-mail. */
export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(emailLimiter, `user:${auth.value.user.id}`)
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

  const result = await CrmEmailBuilderService.testSend(
    auth.value.user.id,
    id,
    templateId,
    parsed.data,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
