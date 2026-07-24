import { TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET } from '@/lib/env/server'
import { ok, type Result } from '@/src/lib/result'
import { expiresInToDate, getJson, postForm } from './http'
import type { SocialAccount, SocialProvider, TokenSet } from './types'

/**
 * Twitter/X OAuth 2.0 (Authorization Code com PKCE — exigido pelo X).
 * Escopos: ler/identificar o usuário (`users.read`, `tweet.read`), publicar
 * (`tweet.write`), anexar mídia (`media.write`) e renovar o token
 * (`offline.access` → refresh token). Cliente confidencial: a troca do
 * code usa HTTP Basic com `client_id:client_secret`. Ao mudar esta lista,
 * contas já conectadas precisam reconectar para reconsentir — o service
 * detecta scope ausente.
 */
const SCOPE = [
  'tweet.read',
  'users.read',
  'tweet.write',
  'media.write',
  'offline.access',
].join(' ')

const AUTHORIZE_URL = 'https://x.com/i/oauth2/authorize'
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token'

/** Cabeçalho `Authorization: Basic base64(clientId:clientSecret)`. */
function basicAuthHeader(): Record<string, string> {
  const credentials = `${TWITTER_CLIENT_ID ?? ''}:${TWITTER_CLIENT_SECRET ?? ''}`
  return {
    Authorization: `Basic ${Buffer.from(credentials).toString('base64')}`,
  }
}

export const twitterProvider: SocialProvider = {
  platform: 'TWITTER',
  usesPkce: true,

  isConfigured() {
    return Boolean(TWITTER_CLIENT_ID && TWITTER_CLIENT_SECRET)
  },

  buildAuthorizeUrl({ redirectUri, state, codeChallenge }) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: TWITTER_CLIENT_ID ?? '',
      redirect_uri: redirectUri,
      scope: SCOPE,
      state,
      // PKCE é obrigatório no X; quando ausente o provedor recusa a
      // autorização.
      code_challenge: codeChallenge ?? '',
      code_challenge_method: 'S256',
    })
    return `${AUTHORIZE_URL}?${params.toString()}`
  },

  async exchangeCode({
    code,
    redirectUri,
    codeVerifier,
  }): Promise<Result<TokenSet>> {
    const result = await postForm<{
      access_token: string
      refresh_token?: string
      expires_in?: number
      scope?: string
    }>(
      TOKEN_URL,
      {
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: TWITTER_CLIENT_ID ?? '',
        code_verifier: codeVerifier ?? '',
      },
      basicAuthHeader(),
    )
    if (!result.ok) return result

    return ok({
      accessToken: result.value.access_token,
      refreshToken: result.value.refresh_token ?? null,
      expiresAt: expiresInToDate(result.value.expires_in),
      scope: result.value.scope ?? SCOPE,
    })
  },

  async fetchAccount(tokens): Promise<Result<SocialAccount>> {
    const result = await getJson<{
      data?: { id?: string; name?: string; username?: string }
    }>(
      'https://api.twitter.com/2/users/me?user.fields=username',
      tokens.accessToken,
    )
    if (!result.ok) return result
    const user = result.value.data
    return ok({
      externalId: user?.id ?? 'unknown',
      // O @handle é mais útil que o nome de exibição para identificar a
      // conta.
      name: user?.username ?? user?.name ?? null,
    })
  },

  async refreshAccessToken(refreshToken): Promise<Result<TokenSet>> {
    const result = await postForm<{
      access_token: string
      refresh_token?: string
      expires_in?: number
      scope?: string
    }>(
      TOKEN_URL,
      {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: TWITTER_CLIENT_ID ?? '',
      },
      basicAuthHeader(),
    )
    if (!result.ok) return result

    return ok({
      accessToken: result.value.access_token,
      // O X devolve um novo refresh token a cada renovação; o service
      // preserva o atual quando vier null.
      refreshToken: result.value.refresh_token ?? null,
      expiresAt: expiresInToDate(result.value.expires_in),
      scope: result.value.scope ?? SCOPE,
    })
  },
}
