import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { crmSocialNotConfigured } from '@/src/errors'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { parseCrmPlatformSlug } from '@/src/schemas/crm-social.schema'
import * as CrmSocialInstagramService from '@/src/services/crm-social-instagram.service'
import * as CrmSocialTiktokService from '@/src/services/crm-social-tiktok.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; platform: string }> }

/**
 * Resumo semanal de engajamento (views/saves/visitas ao perfil + top 5 posts
 * mais quentes dos últimos 7 dias). Só Instagram e TikTok por ora — as demais
 * plataformas não têm um "feed de posts" equivalente na aba Analytics.
 */
export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, platform: platformSlug } = await ctx.params
  const platform = parseCrmPlatformSlug(platformSlug)
  if (!platform) {
    return standardError('VALIDATION_ERROR', 'Plataforma inválida')
  }

  const actorId = auth.value.user.id

  if (platform === 'INSTAGRAM') {
    const result = await CrmSocialInstagramService.getWeeklyEngagement(
      actorId,
      id,
    )
    if (!result.ok) return handleError(result.error)
    return successResponse(result.value)
  }

  if (platform === 'TIKTOK') {
    const result = await CrmSocialTiktokService.getWeeklyEngagement(actorId, id)
    if (!result.ok) return handleError(result.error)
    return successResponse(result.value)
  }

  return handleError(crmSocialNotConfigured())
})
