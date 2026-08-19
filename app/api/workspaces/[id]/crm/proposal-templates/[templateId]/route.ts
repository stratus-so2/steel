import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { UpdateCrmProposalTemplateSchema } from '@/src/schemas/crm-proposal-template.schema'
import { CrmProposalTemplateService } from '@/src/services/crm-proposal-template.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; templateId: string }> }

export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, templateId } = await ctx.params

  const result = await CrmProposalTemplateService.getById(
    auth.value.user.id,
    id,
    templateId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})

export const PATCH = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'PATCH /api/workspaces/[id]/crm/proposal-templates/[templateId]',
  )
  if (!consent.ok) return handleError(consent.error)

  const [{ id, templateId }, body] = await Promise.all([
    ctx.params,
    request.json(),
  ])
  const parsed = UpdateCrmProposalTemplateSchema.safeParse(body)

  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await CrmProposalTemplateService.update(
    auth.value.user.id,
    id,
    templateId,
    parsed.data,
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
    'DELETE /api/workspaces/[id]/crm/proposal-templates/[templateId]',
  )
  if (!consent.ok) return handleError(consent.error)

  const { id, templateId } = await ctx.params

  const result = await CrmProposalTemplateService.remove(
    auth.value.user.id,
    id,
    templateId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(null, 200)
})
