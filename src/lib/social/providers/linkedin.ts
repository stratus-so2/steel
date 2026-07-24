import { LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET } from '@/lib/env/server'
import { ok, type Result } from '@/src/lib/result'
import { expiresInToDate, getJson, postForm } from './http'
import type { SocialAccount, SocialProvider, TokenSet } from './types'

/**
 * LinkedIn OAuth 2.0 (Authorization Code Flow — OpenID Connect).
 * Escopos: openid, profile, email (OIDC) + w_member_social (postagem).
 * Tokens: access 60d, refresh 365d (Standard Access).
 * Redirect URI a registrar: .../api/social/callback/linkedin
 */
const SCOPE = ['openid', 'profile', 'email', 'w_member_social'].join(' ')

const AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization'
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'

export const linkedinProvider: SocialProvider = {
  platform: 'LINKEDIN',

  isConfigured() {
    return Boolean(LINKEDIN_CLIENT_ID && LINKEDIN_CLIENT_SECRET)
  },

  buildAuthorizeUrl({ redirectUri, state }) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: LINKEDIN_CLIENT_ID ?? '',
      redirect_uri: redirectUri,
      scope: SCOPE,
      state,
    })
    return `${AUTHORIZE_URL}?${params.toString()}`
  },

  async exchangeCode({ code, redirectUri }): Promise<Result<TokenSet>> {
    const result = await postForm<{
      access_token: string
      expires_in?: number
      refresh_token?: string
      refresh_token_expires_in?: number
      scope?: string
    }>(TOKEN_URL, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: LINKEDIN_CLIENT_ID ?? '',
      client_secret: LINKEDIN_CLIENT_SECRET ?? '',
    })
    if (!result.ok) return result

    return ok({
      accessToken: result.value.access_token,
      refreshToken: result.value.refresh_token ?? null,
      expiresAt: expiresInToDate(result.value.expires_in),
      scope: result.value.scope ?? SCOPE,
    })
  },

  async fetchAccount(tokens): Promise<Result<SocialAccount>> {
    // OpenID Connect userinfo retorna sub (memberId), name e email.
    const result = await getJson<{
      sub?: string
      name?: string
      email?: string
      picture?: string
    }>('https://api.linkedin.com/v2/userinfo', tokens.accessToken)
    if (!result.ok) return result

    return ok({
      externalId: result.value.sub ?? 'unknown',
      name: result.value.name ?? null,
    })
  },

  async refreshAccessToken(refreshToken): Promise<Result<TokenSet>> {
    const result = await postForm<{
      access_token: string
      expires_in?: number
      refresh_token?: string
      scope?: string
    }>(TOKEN_URL, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: LINKEDIN_CLIENT_ID ?? '',
      client_secret: LINKEDIN_CLIENT_SECRET ?? '',
    })
    if (!result.ok) return result

    return ok({
      accessToken: result.value.access_token,
      refreshToken: result.value.refresh_token ?? null,
      expiresAt: expiresInToDate(result.value.expires_in),
      scope: result.value.scope ?? null,
    })
  },
}
