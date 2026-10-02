import { type NextRequest, NextResponse } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { BETTER_AUTH_URL } from '@/lib/env/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { SdIntegrationService } from '@/src/services/sd-integration.service'

/**
 * Callback OAuth do Slack. É um path **fixo** (o Slack exige redirect URL
 * exata), então o workspace viaja no `state` assinado; a sessão continua
 * obrigatória, porque quem autoriza é o admin logado no Steel.
 *
 * Sem slug conhecido (state inválido), volta para a home autenticada.
 */
function back(
  slug: string | null,
  status: 'connected' | 'error',
  reason?: string,
): NextResponse {
  const url = slug
    ? new URL(`/${slug}/servicedesk/settings`, BETTER_AUTH_URL)
    : new URL('/', BETTER_AUTH_URL)
  if (slug) url.searchParams.set('tab', 'integrations')
  url.searchParams.set('slack', status)
  if (reason) url.searchParams.set('reason', reason)
  return NextResponse.redirect(url, 302)
}

export const GET = withAxiom(async (request: NextRequest) => {
  const auth = await getAuthSession()
  if (!auth.ok) {
    return NextResponse.redirect(new URL('/sign-in', BETTER_AUTH_URL), 302)
  }

  const params = request.nextUrl.searchParams
  const state = params.get('state')
  const code = params.get('code')
  const oauthError = params.get('error')

  if (oauthError || !state || !code) {
    return back(null, 'error', oauthError ?? 'missing_params')
  }

  const result = await SdIntegrationService.completeSlackConnect(
    auth.value.user.id,
    state,
    code,
  )
  if (!result.ok) return back(null, 'error', result.error.code)

  return back(result.value.workspaceSlug, 'connected')
})
