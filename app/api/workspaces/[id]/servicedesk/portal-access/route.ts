import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { validationError } from '@/src/errors'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { IssueSdPortalAccessSchema } from '@/src/schemas/sd-portal.schema'
import { SdPortalAccessService } from '@/src/services/sd-portal-access.service'
import { readJsonBody } from '@/utils/http-request'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string }> }

/**
 * Links de acesso ao portal externo emitidos para um contato
 * (`?contactId=`). Só agentes com `sd-contacts` × `VIEW`.
 */
export const GET = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const contactId = new URL(request.url).searchParams.get('contactId')
  if (!contactId) {
    return handleError(validationError('Informe o contato (`contactId`)'))
  }

  const { id } = await ctx.params
  const result = await SdPortalAccessService.listForContact(
    auth.value.user.id,
    id,
    contactId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})

/**
 * Envia o acesso ao portal para um contato (link mágico de 7 dias, uso
 * único). Invalida os links pendentes do contato e audita a emissão.
 */
export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'POST /api/workspaces/[id]/servicedesk/portal-access',
  )
  if (!consent.ok) return handleError(consent.error)

  const json = await readJsonBody(request)
  if (!json.ok) return handleError(json.error)
  const parsed = IssueSdPortalAccessSchema.safeParse(json.value)
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const { id } = await ctx.params
  const result = await SdPortalAccessService.issue(
    auth.value.user.id,
    id,
    parsed.data,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value, 201)
})
