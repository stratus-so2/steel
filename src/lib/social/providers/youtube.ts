import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '@/lib/env/server'
import { ok, type Result } from '@/src/lib/result'
import { expiresInToDate, getJson, postForm } from './http'
import type { SocialAccount, SocialProvider, TokenSet } from './types'

/**
 * YouTube via Google OAuth. Reusa as credenciais GOOGLE_* já usadas pelo
 * login, mas com fluxo próprio e escopo do YouTube — não interfere no
 * better-auth.
 *
 * Escopos: ver canal/vídeos (`youtube.readonly`), métricas
 * (`yt-analytics.readonly`) e upload de vídeo (`youtube.upload`). Ao mudar
 * esta lista, contas já conectadas precisam reconectar para reconsentir —
 * o service detecta scope ausente.
 */
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'https://www.googleapis.com/auth/youtube.upload',
]
const SCOPE = SCOPES.join(' ')

export const youtubeProvider: SocialProvider = {
  platform: 'YOUTUBE',

  isConfigured() {
    return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET)
  },

  buildAuthorizeUrl({ redirectUri, state }) {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID ?? '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    })
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  },

  async exchangeCode({ code, redirectUri }): Promise<Result<TokenSet>> {
    const result = await postForm<{
      access_token: string
      refresh_token?: string
      expires_in?: number
      scope?: string
    }>('https://oauth2.googleapis.com/token', {
      client_id: GOOGLE_CLIENT_ID ?? '',
      client_secret: GOOGLE_CLIENT_SECRET ?? '',
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    })
    if (!result.ok) return result

    return ok({
      accessToken: result.value.access_token,
      refreshToken: result.value.refresh_token ?? null,
      expiresAt: expiresInToDate(result.value.expires_in),
      scope: result.value.scope ?? SCOPE,
    })
  },

  async fetchAccounts(tokens): Promise<Result<SocialAccount[]>> {
    const result = await getJson<{
      items?: { id: string; snippet?: { title?: string } }[]
    }>(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      tokens.accessToken,
    )
    if (!result.ok) return result
    const channel = result.value.items?.[0]
    return ok([
      {
        externalId: channel?.id ?? 'unknown',
        name: channel?.snippet?.title ?? null,
      },
    ])
  },

  async refreshAccessToken(refreshToken): Promise<Result<TokenSet>> {
    const result = await postForm<{
      access_token: string
      expires_in?: number
      scope?: string
      refresh_token?: string
    }>('https://oauth2.googleapis.com/token', {
      client_id: GOOGLE_CLIENT_ID ?? '',
      client_secret: GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    })
    if (!result.ok) return result

    return ok({
      accessToken: result.value.access_token,
      // O refresh do Google normalmente não devolve um novo refresh token;
      // mantemos o atual (o service preserva quando vier null).
      refreshToken: result.value.refresh_token ?? null,
      expiresAt: expiresInToDate(result.value.expires_in),
      scope: result.value.scope ?? null,
    })
  },
}
