import {
  GOOGLE_ADS_DEVELOPER_TOKEN,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
} from '@/lib/env/server'
import { ok, type Result } from '@/src/lib/result'
import { expiresInToDate, getJson, postForm } from './http'
import type { SocialAccount, SocialProvider, TokenSet } from './types'

/**
 * Google Ads via Google OAuth 2.0 + Google Ads API REST v23.
 * Reusa GOOGLE_CLIENT_ID/SECRET; exige GOOGLE_ADS_DEVELOPER_TOKEN separado
 * (obtido no Google Ads API Center — requer aprovação pelo Google).
 * Escopo: https://www.googleapis.com/auth/adwords
 * Redirect URI a registrar: .../api/social/callback/google_ads
 */
const SCOPE = 'https://www.googleapis.com/auth/adwords'

export const googleAdsProvider: SocialProvider = {
  platform: 'GOOGLE_ADS',

  isConfigured() {
    return Boolean(
      GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_ADS_DEVELOPER_TOKEN,
    )
  },

  buildAuthorizeUrl({ redirectUri, state }) {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID ?? '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPE,
      access_type: 'offline',
      prompt: 'consent',
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
    const devToken = GOOGLE_ADS_DEVELOPER_TOKEN ?? ''
    const bearer = `Bearer ${tokens.accessToken}`
    const base = 'https://googleads.googleapis.com/v23'

    // Lista todas as contas acessíveis pelo token.
    const listResult = await getJson<{ resourceNames?: string[] }>(
      `${base}/customers:listAccessibleCustomers`,
      tokens.accessToken,
      { 'developer-token': devToken },
    )
    if (!listResult.ok) return listResult

    const rootIds = (listResult.value.resourceNames ?? []).map((r) =>
      r.replace('customers/', ''),
    )
    if (rootIds.length === 0) return ok([{ externalId: 'unknown', name: null }])

    type CustomerRow = {
      results?: {
        customer?: { id?: string; descriptiveName?: string; manager?: boolean }
      }[]
    }

    // Classifica cada conta acessível: anunciante direta (não-gerente) ou
    // MCC. Preferimos uma conta anunciante direta; só descemos numa MCC se
    // não houver.
    const managers: { id: string; name: string | null }[] = []
    for (const rootId of rootIds) {
      const infoRes = await fetch(
        `${base}/customers/${rootId}/googleAds:search`,
        {
          method: 'POST',
          headers: {
            Authorization: bearer,
            'developer-token': devToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query:
              'SELECT customer.id, customer.descriptive_name, customer.manager FROM customer LIMIT 1',
          }),
        },
      ).catch(() => null)
      const infoBody = infoRes?.ok ? await infoRes.json().catch(() => ({})) : {}
      const customer = (infoBody as CustomerRow).results?.[0]?.customer
      const isManager = customer?.manager === true

      if (customer && !isManager) {
        // Conta anunciante direta — uso imediato, sem login-customer-id.
        return ok([
          {
            externalId: rootId,
            name: customer.descriptiveName ?? null,
          },
        ])
      }
      managers.push({ id: rootId, name: customer?.descriptiveName ?? null })
    }

    // Nenhuma anunciante direta: busca a primeira sub-conta não-gerente em
    // cada MCC. Armazena como "managerId|subAccountId" para o client usar
    // login-customer-id.
    type ClientRow = {
      results?: {
        customerClient?: {
          id?: string
          descriptiveName?: string
          status?: string
        }
      }[]
    }
    for (const manager of managers) {
      const clientsRes = await fetch(
        `${base}/customers/${manager.id}/googleAds:search`,
        {
          method: 'POST',
          headers: {
            Authorization: bearer,
            'developer-token': devToken,
            'login-customer-id': manager.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query:
              'SELECT customer_client.id, customer_client.descriptive_name, customer_client.status FROM customer_client WHERE customer_client.manager = FALSE LIMIT 50',
          }),
        },
      ).catch(() => null)

      const rawBody = clientsRes ? await clientsRes.text().catch(() => '') : ''
      if (!clientsRes?.ok) continue

      const clients = (JSON.parse(rawBody || '{}') as ClientRow).results ?? []
      // Prefere uma sub-conta ENABLED; se nenhuma vier marcada, aceita a
      // primeira.
      const enabled = clients.find(
        (r) => r.customerClient?.status === 'ENABLED',
      )
      const chosen = (enabled ?? clients[0])?.customerClient

      if (chosen?.id) {
        return ok([
          {
            externalId: `${manager.id}|${chosen.id}`,
            name: chosen.descriptiveName ?? manager.name,
          },
        ])
      }
    }

    // Só MCCs sem sub-conta anunciante ativa — conexão inútil para métricas.
    return ok([{ externalId: 'unknown', name: managers[0]?.name ?? null }])
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
      refreshToken: result.value.refresh_token ?? null,
      expiresAt: expiresInToDate(result.value.expires_in),
      scope: result.value.scope ?? null,
    })
  },
}
