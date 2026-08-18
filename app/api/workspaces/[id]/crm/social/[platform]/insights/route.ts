import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { crmSocialNotConfigured } from '@/src/errors'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { parseCrmPlatformSlug } from '@/src/schemas/crm-social.schema'
import { CrmFacebookInsightsRangeSchema } from '@/src/schemas/crm-social-facebook.schema'
import { CrmSocialGoogleAdsInsightsRangeSchema } from '@/src/schemas/crm-social-google-ads.schema'
import { CrmSocialGoogleAnalyticsInsightsRangeSchema } from '@/src/schemas/crm-social-google-analytics.schema'
import { CrmInstagramInsightsRangeSchema } from '@/src/schemas/crm-social-instagram.schema'
import { CrmSocialYoutubeInsightsRangeSchema } from '@/src/schemas/crm-social-youtube.schema'
import * as CrmSocialFacebookService from '@/src/services/crm-social-facebook.service'
import * as CrmSocialGoogleAdsService from '@/src/services/crm-social-google-ads.service'
import * as CrmSocialGoogleAnalyticsService from '@/src/services/crm-social-google-analytics.service'
import * as CrmSocialInstagramService from '@/src/services/crm-social-instagram.service'
import * as CrmSocialYoutubeService from '@/src/services/crm-social-youtube.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; platform: string }> }

/** Analytics da conta (resumo + série) para a janela em `?range=`. */
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

  const actorId = auth.value.user.id
  const rawRange = request.nextUrl.searchParams.get('range') ?? undefined
  const connectionId =
    request.nextUrl.searchParams.get('connectionId') ?? undefined

  switch (platform) {
    case 'FACEBOOK': {
      const range = CrmFacebookInsightsRangeSchema.safeParse(rawRange)
      if (!range.success) {
        return standardError('VALIDATION_ERROR', 'Janela de tempo inválida')
      }
      const result = await CrmSocialFacebookService.getInsights(
        actorId,
        id,
        range.data,
        connectionId,
      )
      if (!result.ok) return handleError(result.error)
      return successResponse(result.value)
    }
    case 'INSTAGRAM': {
      const range = CrmInstagramInsightsRangeSchema.safeParse(rawRange)
      if (!range.success) {
        return standardError('VALIDATION_ERROR', 'Janela de tempo inválida')
      }
      const result = await CrmSocialInstagramService.getInsights(
        actorId,
        id,
        range.data,
        connectionId,
      )
      if (!result.ok) return handleError(result.error)
      return successResponse(result.value)
    }
    case 'YOUTUBE': {
      const range = CrmSocialYoutubeInsightsRangeSchema.safeParse(rawRange)
      if (!range.success) {
        return standardError('VALIDATION_ERROR', 'Janela de tempo inválida')
      }
      const result = await CrmSocialYoutubeService.getInsights(
        actorId,
        id,
        range.data,
      )
      if (!result.ok) return handleError(result.error)
      return successResponse(result.value)
    }
    case 'GOOGLE_ANALYTICS': {
      const range =
        CrmSocialGoogleAnalyticsInsightsRangeSchema.safeParse(rawRange)
      if (!range.success) {
        return standardError('VALIDATION_ERROR', 'Janela de tempo inválida')
      }
      const result = await CrmSocialGoogleAnalyticsService.getInsights(
        actorId,
        id,
        range.data,
      )
      if (!result.ok) return handleError(result.error)
      return successResponse(result.value)
    }
    case 'GOOGLE_ADS': {
      const range = CrmSocialGoogleAdsInsightsRangeSchema.safeParse(rawRange)
      if (!range.success) {
        return standardError('VALIDATION_ERROR', 'Janela de tempo inválida')
      }
      const result = await CrmSocialGoogleAdsService.getInsights(
        actorId,
        id,
        range.data,
      )
      if (!result.ok) return handleError(result.error)
      return successResponse(result.value)
    }
    default:
      return handleError(crmSocialNotConfigured())
  }
})
