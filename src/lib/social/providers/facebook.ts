import {
  FACEBOOK_APP_ID,
  FACEBOOK_APP_SECRET,
  FACEBOOK_CONFIG_ID,
} from '@/lib/env/server'
import { crmSocialNoPage } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { expiresInToDate, getJson } from './http'
import type { SocialAccount, SocialProvider, TokenSet } from './types'

/** Facebook Login (Graph API). */
const GRAPH = 'https://graph.facebook.com/v21.0'

/**
 * Escopos: identificar e listar Páginas (`pages_show_list`), ler conteúdo e
 * engajamento (`pages_read_engagement`), publicar (`pages_manage_posts`) e
 * ler métricas (`read_insights`). Postagens e insights são da **Página**,
 * não do perfil — por isso trocamos o token do usuário pelo Page token no
 * fetchAccount. Ao mudar esta lista, contas conectadas antes precisam
 * reconectar.
 */
const SCOPES = [
  'public_profile',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'read_insights',
]
const SCOPE = SCOPES.join(',')

export const facebookProvider: SocialProvider = {
  platform: 'FACEBOOK',

  isConfigured() {
    return Boolean(FACEBOOK_APP_ID && FACEBOOK_APP_SECRET)
  },

  buildAuthorizeUrl({ redirectUri, state }) {
    const params = new URLSearchParams({
      client_id: FACEBOOK_APP_ID ?? '',
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
    })
    // Login do Facebook para Empresas: as permissões vêm da configuração
    // (`config_id`), não do `scope`. Sem config (login clássico), usa `scope`.
    if (FACEBOOK_CONFIG_ID) {
      params.set('config_id', FACEBOOK_CONFIG_ID)
    } else {
      params.set('scope', SCOPE)
    }
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

    // 2) token curto → token longo (~60 dias). Páginas derivadas de um token
    // longo não expiram, o que evita refresh para postar/ler insights.
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
    // Lista as Páginas administradas; cada uma traz seu próprio Page token.
    // No v1 conectamos a primeira Página (o nome fica visível na UI).
    // Selecionar entre várias é uma evolução futura.
    const params = new URLSearchParams({
      fields: 'id,name,access_token',
      access_token: tokens.accessToken,
    })
    const result = await getJson<{
      data?: { id: string; name?: string; access_token?: string }[]
    }>(`${GRAPH}/me/accounts?${params.toString()}`)
    if (!result.ok) return result

    const page = result.value.data?.[0]
    if (!page?.access_token) {
      // Sem Página concedida não há onde postar/ler insights — falha
      // claramente para o usuário reconectar e SELECIONAR uma Página (em
      // vez de salvar uma conexão quebrada com o token de usuário).
      return err(crmSocialNoPage())
    }

    return ok({
      externalId: page.id,
      name: page.name ?? null,
      // Page tokens vindos de um token de usuário longo não expiram.
      accessTokenOverride: { accessToken: page.access_token, expiresAt: null },
    })
  },
}
