import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '@/lib/env/server'
import { ok, type Result } from '@/src/lib/result'
import { expiresInToDate, getJson, postForm } from './http'
import type { SocialAccount, SocialProvider, TokenSet } from './types'

/**
 * Google Analytics 4 via Google OAuth. Reusa as credenciais GOOGLE_* (mesmas
 * do YouTube/login), mas com escopo dedicado e fluxo próprio — não
 * interfere no better-auth nem na conexão do YouTube.
 *
 * Escopo: leitura de dados/admin (`analytics.readonly`). Pós-OAuth,
 * escolhemos automaticamente a 1ª propriedade GA4 via Admin API
 * `accountSummaries` (mesma estratégia da 1ª Page do Facebook) — o
 * `externalId` armazenado é o `properties/<id>` que o cliente da Data API
 * exige.
 */
const SCOPES = ['https://www.googleapis.com/auth/analytics.readonly']
const SCOPE = SCOPES.join(' ')

export const googleAnalyticsProvider: SocialProvider = {
  platform: 'GOOGLE_ANALYTICS',

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
    // Admin API account summaries — lista todas as contas + propriedades
    // GA4 (web/app) que o usuário tem acesso, sem precisar de um property ID.
    const result = await getJson<{
      accountSummaries?: {
        account?: string
        displayName?: string
        propertySummaries?: {
          property?: string // "properties/<id>"
          displayName?: string
        }[]
      }[]
    }>(
      'https://analyticsadmin.googleapis.com/v1beta/accountSummaries',
      tokens.accessToken,
    )
    if (!result.ok) return result

    // Pega a 1ª propriedade da 1ª conta que tenha alguma — espelha o
    // pattern do Facebook (1ª Page). Sem propriedades acessíveis, fica como
    // "unknown" e o service responde scope/conexão inutilizável.
    const firstProperty = result.value.accountSummaries
      ?.flatMap((acc) =>
        (acc.propertySummaries ?? []).map((p) => ({
          property: p.property,
          accountName: acc.displayName,
          propertyName: p.displayName,
        })),
      )
      .find((p) => p.property)

    return ok([
      {
        externalId: firstProperty?.property ?? 'unknown',
        name: firstProperty?.propertyName ?? firstProperty?.accountName ?? null,
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
