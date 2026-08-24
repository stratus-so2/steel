import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { crmSocialNotConfigured } from '@/src/errors'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { parseCrmPlatformSlug } from '@/src/schemas/crm-social.schema'
import * as CrmSocialInstagramService from '@/src/services/crm-social-instagram.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; platform: string }> }

/** Stories ativas (últimas 24h). Só Instagram — as demais plataformas não têm o conceito. */
export const GET = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, platform: platformSlug } = await ctx.params
  const platform = parseCrmPlatformSlug(platformSlug)
  if (!platform) {
    return standardError('VALIDATION_ERROR', 'Plataforma inválida')
  }

  if (platform !== 'INSTAGRAM') {
    return handleError(crmSocialNotConfigured())
  }

  const actorId = auth.value.user.id
  const connectionId =
    request.nextUrl.searchParams.get('connectionId') ?? undefined

  const result = await CrmSocialInstagramService.getStories(
    actorId,
    id,
    connectionId,
  )
  if (!result.ok) return handleError(result.error)
  return successResponse(result.value)
})
