import type { CrmSocialConnection } from '@prisma/client'
import { crmSocialConnectionNotFound } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  decryptToken,
  encryptToken,
  isTokenCryptoConfigured,
} from '@/src/lib/social/crypto'
import { getProvider } from '@/src/lib/social/providers'
import { CrmSocialConnectionRepository } from '@/src/repositories/crm-social.repository'
import type { CRM_SOCIAL_PLATFORMS } from '@/src/schemas/crm-social.schema'

/** Margem antes da expiração em que já tentamos renovar proativamente. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000

/**
 * Garante um access token válido para a conexão da plataforma no workspace:
 * decifra o token corrente se ainda não está perto de expirar, ou tenta
 * renovar via `provider.refreshAccessToken()`. Em caso de falha/token sem
 * suporte a refresh, marca a conexão como `EXPIRED` para o usuário reconectar.
 */
export async function getFreshAccessToken(
  workspaceId: string,
  platform: (typeof CRM_SOCIAL_PLATFORMS)[number],
  connectionId?: string,
): Promise<Result<{ accessToken: string; connection: CrmSocialConnection }>> {
  if (!isTokenCryptoConfigured()) {
    return err(crmSocialConnectionNotFound())
  }

  const found = connectionId
    ? await CrmSocialConnectionRepository.findById(connectionId, workspaceId)
    : await CrmSocialConnectionRepository.findPrimaryByPlatform(
        workspaceId,
        platform,
      )
  if (!found.ok) return found
  const connection = found.value
  if (!connection?.accessToken) {
    return err(crmSocialConnectionNotFound())
  }
  if (connection.status !== 'CONNECTED') {
    return err(crmSocialConnectionNotFound())
  }

  const expiresAt = connection.tokenExpiresAt
  const nearExpiry = expiresAt
    ? expiresAt.getTime() - REFRESH_MARGIN_MS <= Date.now()
    : false

  if (!nearExpiry) {
    return ok({
      accessToken: decryptToken(connection.accessToken),
      connection,
    })
  }

  const provider = getProvider(platform)
  if (!connection.refreshToken || !provider.refreshAccessToken) {
    await CrmSocialConnectionRepository.setStatus(connection.id, 'EXPIRED')
    return err(crmSocialConnectionNotFound())
  }

  const refreshed = await provider.refreshAccessToken(
    decryptToken(connection.refreshToken),
  )
  if (!refreshed.ok) {
    await CrmSocialConnectionRepository.setStatus(connection.id, 'EXPIRED')
    return refreshed
  }

  const updated = await CrmSocialConnectionRepository.updateTokens(
    connection.id,
    {
      accessToken: encryptToken(refreshed.value.accessToken),
      refreshToken: refreshed.value.refreshToken
        ? encryptToken(refreshed.value.refreshToken)
        : connection.refreshToken,
      tokenExpiresAt: refreshed.value.expiresAt,
      scope: refreshed.value.scope ?? connection.scope,
    },
  )
  if (!updated.ok) return updated

  return ok({
    accessToken: refreshed.value.accessToken,
    connection: updated.value,
  })
}
