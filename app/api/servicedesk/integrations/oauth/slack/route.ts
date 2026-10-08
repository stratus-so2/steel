import { type NextRequest, NextResponse } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { BETTER_AUTH_URL } from '@/lib/env/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { WorkspaceIntegrationService } from '@/src/services/workspace-integration.service'

/**
 * Slack OAuth callback. The path is **fixed** (Slack requires the exact
 * redirect URL registered in the app, so it keeps its historical
 * `/servicedesk/` path); the workspace travels in the signed `state`, and the
 * session is still required because the admin logged in Steel authorizes.
 * Since ADR 0024 the connection is workspace-level, so the callback lands on
 * Ajustes > Integrações.
 *
 * Without a known slug (invalid state), goes back to the authenticated home.
 */
function back(
  slug: string | null,
  status: 'connected' | 'error',
  reason?: string,
): NextResponse {
  const url = slug
    ? new URL(`/${slug}/settings/integrations`, BETTER_AUTH_URL)
    : new URL('/', BETTER_AUTH_URL)
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

  const result = await WorkspaceIntegrationService.completeSlackConnect(
    auth.value.user.id,
    state,
    code,
  )
  if (!result.ok) return back(null, 'error', result.error.code)

  return back(result.value.workspaceSlug, 'connected')
})
