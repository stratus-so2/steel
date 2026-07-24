import { FACEBOOK_APP_ID, FACEBOOK_APP_SECRET } from '@/lib/env/server'
import { crmSocialIgNotLinked } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { expiresInToDate, getJson } from './http'
import type { SocialAccount, SocialProvider, TokenSet } from './types'

/**
 * Instagram via Facebook Login (Graph API). O fluxo OAuth é do Facebook —
 * trocamos o token de usuário por um Page token (Página →
 * `instagram_business_account`) e guardamos o id da conta do Instagram. Não
 * usa `FACEBOOK_CONFIG_ID` do FB Business Login porque ele já carrega
 * escopos só de Página; aqui pedimos os escopos IG explicitamente via
 * `scope=`.
 */
const GRAPH = 'https://graph.facebook.com/v21.0'

const SCOPES = [
  'public_profile',
  'pages_show_list',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_insights',
]
const SCOPE = SCOPES.join(',')

export const instagramProvider: SocialProvider = {
  platform: 'INSTAGRAM',

  isConfigured() {
    return Boolean(FACEBOOK_APP_ID && FACEBOOK_APP_SECRET)
  },

  buildAuthorizeUrl({ redirectUri, state }) {
    const params = new URLSearchParams({
      client_id: FACEBOOK_APP_ID ?? '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPE,
      state,
    })
    return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`
  },

  async exchangeCode({ code, redirectUri }): Promise<Result<TokenSet>> {
    // 1) code → token de usuário (curta duração).
    const shortParams = new URLSearchParams({
      client_id: FACEBOOK_APP_ID ?? '',
      client_secret: FACEBOOK_APP_SECRET ?? '',
      redirect_uri: redirectUri,
      code,
    })
    const short = await getJson<{ access_token: string }>(
      `${GRAPH}/oauth/access_token?${shortParams.toString()}`,
    )
    if (!short.ok) return short

    // 2) token curto → token longo (~60 dias). Page tokens derivados de um
    // token longo não expiram, o que permite postar/ler insights sem refresh.
    const longParams = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: FACEBOOK_APP_ID ?? '',
      client_secret: FACEBOOK_APP_SECRET ?? '',
      fb_exchange_token: short.value.access_token,
    })
    const long = await getJson<{ access_token: string; expires_in?: number }>(
      `${GRAPH}/oauth/access_token?${longParams.toString()}`,
    )
    if (!long.ok) return long

    return ok({
      accessToken: long.value.access_token,
      refreshToken: null,
      expiresAt: expiresInToDate(long.value.expires_in),
      scope: SCOPE,
    })
  },

  async fetchAccount(tokens): Promise<Result<SocialAccount>> {
    // Para chegar ao IG: pegar as Páginas administradas, descobrir aquela
    // que tem uma conta IG Business/Creator vinculada e usar o **Page
    // token** para todas as chamadas do IG (Graph API delega o auth via
    // Page). Sem IG vinculado, falha claramente em vez de salvar uma
    // conexão quebrada.
    const params = new URLSearchParams({
      fields:
        'id,name,access_token,instagram_business_account{id,username,name}',
      access_token: tokens.accessToken,
    })
    const result = await getJson<{
      data?: {
        id: string
        name?: string
        access_token?: string
        instagram_business_account?: {
          id: string
          username?: string
          name?: string
        }
      }[]
    }>(`${GRAPH}/me/accounts?${params.toString()}`)
    if (!result.ok) return result

    const pageWithIg = (result.value.data ?? []).find(
      (page) => page.instagram_business_account?.id && page.access_token,
    )
    if (!pageWithIg) return err(crmSocialIgNotLinked())

    const ig = pageWithIg.instagram_business_account
    if (!ig) return err(crmSocialIgNotLinked())

    const displayName = ig.username
      ? `@${ig.username}`
      : (ig.name ?? pageWithIg.name ?? null)

    return ok({
      externalId: ig.id,
      name: displayName,
      // Page token derivado de token longo não expira.
      accessTokenOverride: {
        accessToken: pageWithIg.access_token as string,
        expiresAt: null,
      },
    })
  },
}
