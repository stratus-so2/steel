import type { SdIntegration } from '@prisma/client'
import { sdIntegrationNotConfigured } from '@/src/errors'
import { decryptConnectionSecret } from '@/src/lib/crypto'
import { err, ok, type Result } from '@/src/lib/result'

/**
 * Decifra as credenciais da integração (`CONNECTION_SECRETS`). Uma chave
 * trocada ou um envelope corrompido viram `SD_INTEGRATION_NOT_CONFIGURED` em
 * vez de exceção — e o valor em claro nunca sai daqui para log nenhum.
 */

export async function decryptSdIntegrationToken(
  integration: SdIntegration,
): Promise<Result<string>> {
  if (integration.encryptedToken === '') {
    return err(
      sdIntegrationNotConfigured('A integração está sem token — reconecte'),
    )
  }
  try {
    const token = await decryptConnectionSecret(integration.encryptedToken)
    if (token === '') {
      return err(
        sdIntegrationNotConfigured('A integração está sem token — reconecte'),
      )
    }
    return ok(token)
  } catch {
    return err(
      sdIntegrationNotConfigured(
        'Não foi possível ler as credenciais da integração',
      ),
    )
  }
}

/** `null` quando a integração não tem segredo de assinatura guardado. */
export async function decryptSdIntegrationSecret(
  integration: SdIntegration,
): Promise<Result<string | null>> {
  if (!integration.encryptedSigningSecret) return ok(null)
  try {
    return ok(await decryptConnectionSecret(integration.encryptedSigningSecret))
  } catch {
    return err(
      sdIntegrationNotConfigured(
        'Não foi possível ler o segredo do webhook da integração',
      ),
    )
  }
}
