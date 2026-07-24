import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { parseCrmPlatformSlug } from '@/src/schemas/crm-social.schema'
import { CrmSocialConnectionService } from '@/src/services/crm-social.service'
import { handleError, standardError } from '@/utils/http-response'

type Params = { params: Promise<{ id: string; platform: string }> }

const PKCE_COOKIE = 'social_pkce'

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

  const result = await CrmSocialConnectionService.beginConnect(
    auth.value.user.id,
    id,
    platform,
  )
  if (!result.ok) return handleError(result.error)

  const response = Response.redirect(result.value.authorizeUrl, 302)
  if (result.value.pkceVerifier) {
    response.headers.append(
      'Set-Cookie',
      `${PKCE_COOKIE}=${result.value.pkceVerifier}; Path=/api/social/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    )
  }
  return response
})
